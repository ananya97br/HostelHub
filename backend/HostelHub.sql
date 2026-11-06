e-- =====================================================
-- DBMS LEVEL 3 - HOSTEL ROOM ALLOCATION & COMPLAINT SYSTEM
-- MySQL 8.0+ + Qdrant (semantic complaint search only)
-- =====================================================
-- FULL INSTALL SCRIPT: run against a NEW/EMPTY hostel_management database.
-- This script does not drop existing data. Do not rerun it over an existing schema.
-- MySQL stores relational records and a vector-index sync outbox.
-- Qdrant stores the actual 384-dimensional complaint embeddings.
-- Django backend/worker creates embeddings and synchronizes Qdrant.
--
-- Embedding model: sentence-transformers/all-MiniLM-L6-v2 (384 dimensions)
-- Qdrant collection: hostel_complaints (COSINE metric)
-- Qdrant point ID: integer Complaint.complaint_id
-- Vectorized text: complaint_type + ': ' + description
-- Qdrant payload: complaint_id, complaint_type, room_id, status, priority
-- Search flow: embed query -> Qdrant similarity search -> authorize and
--              fetch complaint records in MySQL by returned complaint_id.
-- MySQL alone cannot create or query Qdrant vectors; backend integration
-- is required. Triggers enqueue work, but DO NOT call Qdrant.
-- =====================================================

-- 1. CREATE DATABASE
CREATE DATABASE IF NOT EXISTS dormdesk_db
    CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE dormdeskdb;

-- =====================================================
-- 2. CREATE TABLES (with PK, FK, constraints inline)
-- =====================================================

CREATE TABLE Staff (
    staff_id       INT PRIMARY KEY AUTO_INCREMENT,
    name           VARCHAR(100) NOT NULL,
    role           VARCHAR(20) NOT NULL CHECK (role IN ('Warden','Admin','Maintenance','Security')),
    contact_number VARCHAR(15) UNIQUE NOT NULL,
    email          VARCHAR(100) UNIQUE,
    hostel_id      INT NULL  -- FK added later via ALTER (Step 5) to avoid circular dependency
);

CREATE TABLE Hostel (
    hostel_id   INT PRIMARY KEY AUTO_INCREMENT,
    hostel_name VARCHAR(100) NOT NULL UNIQUE,
    gender_type VARCHAR(10) NOT NULL CHECK (gender_type IN ('Boys','Girls','Co-ed')),
    total_rooms INT NOT NULL DEFAULT 0 CHECK (total_rooms >= 0),
    warden_id   INT,
    address     VARCHAR(200),
    CONSTRAINT fk_hostel_warden FOREIGN KEY (warden_id) REFERENCES Staff(staff_id)
        ON DELETE SET NULL
);

CREATE TABLE Room (
    room_id           INT PRIMARY KEY AUTO_INCREMENT,
    hostel_id         INT NOT NULL,
    room_number       VARCHAR(10) NOT NULL,
    floor_number      INT NOT NULL CHECK (floor_number >= 0),
    room_type         VARCHAR(20) NOT NULL CHECK (room_type IN ('Single','Double','Triple','Dormitory')),
    capacity          INT NOT NULL CHECK (capacity > 0),
    current_occupancy INT NOT NULL DEFAULT 0 CHECK (current_occupancy >= 0),
    status            VARCHAR(20) NOT NULL DEFAULT 'Available'
                      CHECK (status IN ('Available','Full','Under Maintenance','Blocked')),
    rent_per_semester DECIMAL(10,2) NOT NULL DEFAULT 0.00 CHECK (rent_per_semester >= 0),
    CONSTRAINT fk_room_hostel FOREIGN KEY (hostel_id) REFERENCES Hostel(hostel_id)
        ON DELETE CASCADE,
    CONSTRAINT uq_room_per_hostel UNIQUE (hostel_id, room_number),
    CONSTRAINT chk_occupancy_capacity CHECK (current_occupancy <= capacity)
);

CREATE TABLE Student (
    student_id        INT PRIMARY KEY AUTO_INCREMENT,
    name              VARCHAR(100) NOT NULL,
    gender            VARCHAR(10) NOT NULL CHECK (gender IN ('Male','Female','Other')),
    date_of_birth     DATE NOT NULL,
    department        VARCHAR(50) NOT NULL,
    year_of_study     INT NOT NULL CHECK (year_of_study BETWEEN 1 AND 5),
    contact_number    VARCHAR(15) UNIQUE NOT NULL,
    email             VARCHAR(100) UNIQUE NOT NULL,
    guardian_name     VARCHAR(100),
    guardian_contact  VARCHAR(15),
    special_requirements VARCHAR(200),
    admission_date    DATE NOT NULL DEFAULT (CURRENT_DATE)
);

-- NOTE: This table's CREATE statement was not shown in the lab screenshots,
-- but the sample data below inserts into it (ROOM_PREFERENCE in the ER diagram),
-- so it is defined here so the script runs end to end.
CREATE TABLE Preference (
    preference_id       INT PRIMARY KEY AUTO_INCREMENT,
    student_id          INT NOT NULL,
    preferred_hostel_id INT,
    preferred_room_type VARCHAR(20) CHECK (preferred_room_type IN ('Single','Double','Triple','Dormitory')),
    preferred_floor     INT CHECK (preferred_floor >= 0),
    priority_rank       INT NOT NULL DEFAULT 1 CHECK (priority_rank >= 1),
    CONSTRAINT fk_pref_student FOREIGN KEY (student_id) REFERENCES Student(student_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_pref_hostel FOREIGN KEY (preferred_hostel_id) REFERENCES Hostel(hostel_id)
        ON DELETE SET NULL
);

CREATE TABLE Allocation (
    allocation_id   INT PRIMARY KEY AUTO_INCREMENT,
    student_id      INT NOT NULL,
    room_id         INT NOT NULL,
    academic_year   VARCHAR(9) NOT NULL,      -- e.g. '2025-2026'
    allocation_date DATE NOT NULL DEFAULT (CURRENT_DATE),
    vacate_date     DATE,
    status          VARCHAR(20) NOT NULL DEFAULT 'Allocated'
                    CHECK (status IN ('Allocated','Vacated','Pending','Cancelled')),
    allocated_by    INT,
    CONSTRAINT fk_alloc_student FOREIGN KEY (student_id) REFERENCES Student(student_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_alloc_room FOREIGN KEY (room_id) REFERENCES Room(room_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_alloc_staff FOREIGN KEY (allocated_by) REFERENCES Staff(staff_id)
        ON DELETE SET NULL,
    CONSTRAINT chk_vacate_after_alloc CHECK (vacate_date IS NULL OR vacate_date >= allocation_date)
);

CREATE TABLE Complaint (
    complaint_id      INT PRIMARY KEY AUTO_INCREMENT,
    student_id        INT NOT NULL,
    room_id           INT NOT NULL,
    complaint_type    VARCHAR(30) NOT NULL
                      CHECK (complaint_type IN ('Electrical','Plumbing','Furniture','Cleanliness','Roommate Issue','Security','Other')),
    description       VARCHAR(500) NOT NULL,
    date_filed        DATE NOT NULL DEFAULT (CURRENT_DATE),
    priority          VARCHAR(10) NOT NULL DEFAULT 'Medium'
                      CHECK (priority IN ('Low','Medium','High','Urgent')),
    status            VARCHAR(20) NOT NULL DEFAULT 'Open'
                      CHECK (status IN ('Open','In-Progress','Resolved','Rejected')),
    assigned_to       INT,
    resolution_date   DATE,
    resolution_remarks VARCHAR(500),
    updated_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_complaint_student FOREIGN KEY (student_id) REFERENCES Student(student_id)
        ON DELETE RESTRICT,
    CONSTRAINT fk_complaint_room FOREIGN KEY (room_id) REFERENCES Room(room_id)
        ON DELETE RESTRICT,
    CONSTRAINT fk_complaint_staff FOREIGN KEY (assigned_to) REFERENCES Staff(staff_id)
        ON DELETE SET NULL,
    CONSTRAINT chk_resolution_after_filed CHECK (resolution_date IS NULL OR resolution_date >= date_filed)
);


-- =====================================================
-- 2A. SEMANTIC SEARCH OUTBOX
-- =====================================================
-- The Django worker processes Pending events in event_id order.
-- UPSERT: read current complaint from MySQL, embed text, upsert Qdrant point.
-- DELETE: remove point from Qdrant (complaint_id is the point ID).
-- Mark each event Completed after Qdrant succeeds, or Failed with error.
-- Check for newer events for the same complaint so older work never
-- overwrites a newer index state. Retry failed events when appropriate.
-- No FK to Complaint: DELETE events must survive removal of the complaint.
CREATE TABLE Complaint_Vector_Outbox (
    event_id        BIGINT PRIMARY KEY AUTO_INCREMENT,
    complaint_id    INT NOT NULL,
    operation       ENUM('UPSERT', 'DELETE') NOT NULL,
    sync_status     ENUM('Pending', 'Processing', 'Completed', 'Failed')
                    NOT NULL DEFAULT 'Pending',
    attempts        INT NOT NULL DEFAULT 0 CHECK (attempts >= 0),
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    processed_at    TIMESTAMP NULL DEFAULT NULL,
    last_error      VARCHAR(1000) NULL,
    INDEX idx_outbox_work (sync_status, event_id),
    INDEX idx_outbox_complaint (complaint_id, event_id)
);

-- MySQL triggers notify the application to update the Qdrant collection.
DELIMITER $$

CREATE TRIGGER trg_complaint_vector_insert
AFTER INSERT ON Complaint
FOR EACH ROW
BEGIN
    INSERT INTO Complaint_Vector_Outbox (complaint_id, operation)
    VALUES (NEW.complaint_id, 'UPSERT');
END$$

CREATE TRIGGER trg_complaint_vector_update
AFTER UPDATE ON Complaint
FOR EACH ROW
BEGIN
    -- Reindex when the embedded text or searchable payload changes.
    IF NOT (OLD.description <=> NEW.description)
       OR NOT (OLD.complaint_type <=> NEW.complaint_type)
       OR NOT (OLD.room_id <=> NEW.room_id)
       OR NOT (OLD.status <=> NEW.status)
       OR NOT (OLD.priority <=> NEW.priority) THEN
        INSERT INTO Complaint_Vector_Outbox (complaint_id, operation)
        VALUES (NEW.complaint_id, 'UPSERT');
    END IF;
END$$

CREATE TRIGGER trg_complaint_vector_delete
AFTER DELETE ON Complaint
FOR EACH ROW
BEGIN
    INSERT INTO Complaint_Vector_Outbox (complaint_id, operation)
    VALUES (OLD.complaint_id, 'DELETE');
END$$

DELIMITER ;

-- Complaint foreign keys use ON DELETE RESTRICT so parent deletion cannot
-- silently cascade into Complaint, bypass its triggers, and leave stale vectors.
-- Delete complaint records explicitly via SQL/application before removing
-- a related Student or Room. This also preserves complaint audit integrity.

-- =====================================================
-- 3. SAMPLE DATA
-- =====================================================

INSERT INTO Staff (name, role, contact_number, email) VALUES
    ('Ramesh Kumar', 'Warden', '9000000001', 'ramesh@hostel.edu'),
    ('Sita Rao', 'Admin', '9000000002', 'sita@hostel.edu'),
    ('Vijay Singh', 'Maintenance', '9000000003', 'vijay@hostel.edu');

INSERT INTO Hostel (hostel_name, gender_type, total_rooms, warden_id, address) VALUES
    ('Block A', 'Boys', 50, 1, 'North Campus'),
    ('Block B', 'Girls', 40, 1, 'South Campus');

INSERT INTO Room (hostel_id, room_number, floor_number, room_type, capacity, current_occupancy, rent_per_semester) VALUES
    (1, 'A101', 1, 'Double', 2, 1, 15000.00),
    (1, 'A102', 1, 'Single', 1, 0, 20000.00),
    (2, 'B201', 2, 'Triple', 3, 2, 12000.00);

INSERT INTO Student (name, gender, date_of_birth, department, year_of_study, contact_number, email, guardian_name, guardian_contact) VALUES
    ('Arjun Mehta', 'Male', '2005-03-14', 'CSE', 2, '9111111111', 'arjun@college.edu', 'Suresh Mehta', '9222222222'),
    ('Priya Nair', 'Female', '2004-11-02', 'ECE', 3, '9333333333', 'priya@college.edu', 'Ravi Nair', '9444444444');

INSERT INTO Preference (student_id, preferred_hostel_id, preferred_room_type, preferred_floor, priority_rank) VALUES
    (1, 1, 'Single', 1, 1),
    (2, 2, 'Double', 2, 1);

INSERT INTO Allocation (student_id, room_id, academic_year, allocated_by) VALUES
    (1, 1, '2025-2026', 2),
    (2, 3, '2025-2026', 2);

INSERT INTO Complaint (student_id, room_id, complaint_type, description, priority, assigned_to) VALUES
    (1, 1, 'Electrical', 'Fan not working in room A101', 'High', 3),
    (2, 3, 'Plumbing', 'Leaking tap in bathroom', 'Medium', 3);

-- Additional sample complaints let semantic search find phrases that have
-- similar meanings but different keywords (e.g., 'tap' vs 'faucet').
INSERT INTO Complaint
    (student_id, room_id, complaint_type, description, priority, status,
     assigned_to, resolution_date, resolution_remarks)
VALUES
    (1, 1, 'Electrical', 'Ceiling fan rattles loudly whenever I switch it on',
     'Medium', 'Open', 3, NULL, NULL),
    (1, 1, 'Electrical', 'Fan makes a vibrating buzzing sound during operation',
     'Medium', 'Resolved', 3, CURRENT_DATE, 'Tightened loose fan mounting screws'),
    (2, 3, 'Plumbing', 'Water keeps dripping from the washroom faucet',
     'Low', 'Resolved', 3, CURRENT_DATE, 'Replaced worn tap washer'),
    (2, 3, 'Plumbing', 'The bathroom tap will not stop leaking',
     'Medium', 'In-Progress', 3, NULL, NULL),
    (1, 1, 'Furniture', 'Study table leg is broken and the desk is unstable',
     'High', 'Open', 3, NULL, NULL),
    (2, 3, 'Cleanliness', 'Bathroom floor is dirty even after cleaning',
     'Medium', 'Open', 3, NULL, NULL);

-- =====================================================
-- 4. INDEXES
-- =====================================================

CREATE INDEX idx_student_email ON Student(email);
CREATE INDEX idx_room_hostel ON Room(hostel_id);
CREATE INDEX idx_allocation_student ON Allocation(student_id);
CREATE INDEX idx_allocation_room ON Allocation(room_id);
CREATE INDEX idx_complaint_status ON Complaint(status);
CREATE UNIQUE INDEX idx_staff_email ON Staff(email);

-- =====================================================
-- 5. ALTER TABLE DEMONSTRATION
-- =====================================================

ALTER TABLE Staff
    ADD CONSTRAINT fk_staff_hostel FOREIGN KEY (hostel_id) REFERENCES Hostel(hostel_id)
        ON DELETE SET NULL;

ALTER TABLE Student ADD COLUMN category VARCHAR(20) DEFAULT 'General';

ALTER TABLE Complaint MODIFY COLUMN description VARCHAR(1000) NOT NULL;

ALTER TABLE Room ADD CONSTRAINT chk_rent_positive CHECK (rent_per_semester >= 0);

ALTER TABLE Hostel RENAME COLUMN address TO hostel_address;

ALTER TABLE Student DROP COLUMN category;

-- =====================================================
-- 6. DROP DEMONSTRATION
-- =====================================================

DROP INDEX idx_staff_email ON Staff;

ALTER TABLE Room DROP CONSTRAINT chk_rent_positive;

CREATE TABLE Staging_Import (temp_id INT, raw_data VARCHAR(255));

DROP TABLE Staging_Import;

-- =====================================================
-- 7. VIEWS
-- =====================================================

CREATE VIEW vw_room_occupancy AS
SELECT h.hostel_name, r.room_number, r.room_type, r.capacity,
       r.current_occupancy, (r.capacity - r.current_occupancy) AS vacant_seats, r.status
FROM Room r
JOIN Hostel h ON r.hostel_id = h.hostel_id;

CREATE VIEW vw_student_allocation AS
SELECT s.student_id, s.name AS student_name, h.hostel_name, r.room_number,
       a.academic_year, a.allocation_date, a.status AS allocation_status
FROM Allocation a
JOIN Student s ON a.student_id = s.student_id
JOIN Room r ON a.room_id = r.room_id
JOIN Hostel h ON r.hostel_id = h.hostel_id;

CREATE VIEW vw_open_complaints AS
SELECT c.complaint_id, s.name AS student_name, r.room_number, c.complaint_type,
       c.priority, c.status, st.name AS assigned_staff, c.date_filed
FROM Complaint c
JOIN Student s ON c.student_id = s.student_id
JOIN Room r ON c.room_id = r.room_id
LEFT JOIN Staff st ON c.assigned_to = st.staff_id
WHERE c.status IN ('Open', 'In-Progress');

CREATE VIEW vw_complaint_summary AS
SELECT h.hostel_name, COUNT(c.complaint_id) AS total_complaints,
       SUM(CASE WHEN c.status = 'Resolved' THEN 1 ELSE 0 END) AS resolved_count
FROM Complaint c
JOIN Room r ON c.room_id = r.room_id
JOIN Hostel h ON r.hostel_id = h.hostel_id
GROUP BY h.hostel_name;

-- =====================================================
-- 7A. SEARCH DATA SOURCE VIEW
-- =====================================================
-- Backend fetches indexed text and safe metadata from this view.
-- Do not copy student names, phone numbers or emails into Qdrant payload.
CREATE VIEW vw_semantic_complaint_source AS
SELECT
    c.complaint_id,
    c.complaint_type,
    c.description,
    CONCAT(c.complaint_type, ': ', c.description) AS embedding_text,
    c.room_id,
    r.room_number,
    h.hostel_id,
    h.hostel_name,
    c.status,
    c.priority,
    c.date_filed,
    c.updated_at
FROM Complaint c
JOIN Room r ON c.room_id = r.room_id
JOIN Hostel h ON r.hostel_id = h.hostel_id;

-- A dashboard to inspect pending/successful vector-sync events.
CREATE VIEW vw_semantic_index_sync AS
SELECT
    event_id,
    complaint_id,
    operation,
    sync_status,
    attempts,
    created_at,
    processed_at,
    last_error
FROM Complaint_Vector_Outbox;

-- =====================================================
-- 8. VERIFICATION QUERIES
-- =====================================================

SELECT * FROM vw_room_occupancy;
SELECT * FROM vw_student_allocation;
SELECT * FROM vw_open_complaints;
SELECT * FROM vw_complaint_summary;
SELECT * FROM vw_semantic_complaint_source;
SELECT * FROM vw_semantic_index_sync ORDER BY event_id;

-- =====================================================
-- 9. SEMANTIC COMPLAINT SEARCH: EXAMPLE APPLICATION QUERY
-- =====================================================
-- 1) Django API embeds a user's natural-language query using the SAME model.
-- 2) Search 'hostel_complaints' in Qdrant with cosine similarity.
-- 3) Qdrant returns candidate complaint_id values in similarity order.
-- 4) IMPORTANT: validate the logged-in user's permissions in MySQL before
--    showing results; do not trust vector-search metadata for authorization.
-- 5) Retrieve complete complaint information with a parameterized SQL query.
-- Example below uses IDs 2 and 6 purely as a demonstration. Replace these
-- IDs with the actual IDs returned by Qdrant; preserve score ordering in code.
SELECT c.complaint_id, c.description, c.complaint_type, c.status,
       c.priority, r.room_number, h.hostel_name
FROM Complaint c
JOIN Room r ON r.room_id = c.room_id
JOIN Hostel h ON h.hostel_id = r.hostel_id
WHERE c.complaint_id IN (2, 6)
ORDER BY FIELD(c.complaint_id, 2, 6);

-- The worker, NOT this SQL script, must:
--   * Create the 'hostel_complaints' Qdrant collection (size=384, cosine).
--   * Read Pending outbox events and fetch the latest Complaint data.
--   * Upsert/delete Qdrant points, then update sync_status in MySQL.
--   * Avoid applying superseded events out of order; reconcile if needed.
--   * Build the semantic-search endpoint in Django; Next.js calls that API.
-- Until that backend/worker exists, the outbox will contain Pending events,
-- and no actual semantic vector search will occur.

