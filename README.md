# HostelHub

### Hostel Room Allocation and Complaint Management System

HostelHub is a full-stack hostel management application designed to streamline room allocation, student accommodation records, and maintenance complaint management.

The system combines a relational database with a vector database to support structured hostel operations and semantic complaint search.

Built using **Next.js, Django REST Framework, MySQL, and Qdrant**, HostelHub provides a centralized platform for students, wardens, and administrators.

## Overview

Traditional hostel management often involves manual room allocation, fragmented student records, and inefficient complaint tracking. HostelHub addresses these challenges through a unified web application that manages accommodation and maintenance workflows.

The system uses MySQL for structured transactional data and Qdrant for similarity-based complaint retrieval, allowing users to find related maintenance issues even when different terminology is used.

## Features

### Hostel and Room Management
- View hostel blocks and their accommodation details.
- Track room capacity, occupancy, and availability.
- Manage room allocations and student accommodation records.
- Support room vacation and reassignment.
- Maintain allocation history for auditing and tracking.

### Complaint Management
- Register maintenance complaints across multiple categories.
- Assign complaints to authorized staff.
- Categorize complaints by priority and status.
- Track complaint resolution and maintenance remarks.
- Filter complaints based on their attributes.

### Semantic Complaint Search
- Search complaints using natural-language queries.
- Retrieve semantically similar complaints without relying on exact keyword matches.
- Generate sentence embeddings using Sentence Transformers.
- Store and search vector embeddings using Qdrant.
- Synchronize complaint changes between MySQL and Qdrant.

### Role-Based Access Control
HostelHub supports three primary user roles:

| Role | Responsibilities |
|------|------------------|
| Administrator | Manage hostels, students, allocations, staff, and complaints |
| Warden | Monitor assigned hostels, room allocations, and maintenance activities |
| Student | Access accommodation information and manage permitted complaint workflows |

Access to data and operations is controlled through backend authentication and role-based permissions.

### Dashboard and User Interface
- Responsive web interface built with Next.js.
- Light, minimalist design.
- Hostel and room occupancy summaries.
- Complaint management and tracking interfaces.
- Role-specific navigation and functionality.

## Technology Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js, React, TypeScript |
| Styling | Tailwind CSS |
| Backend | Python, Django, Django REST Framework |
| Relational Database | MySQL |
| Vector Database | Qdrant |
| Embedding Model | Sentence Transformers (`all-MiniLM-L6-v2`) |
| Containerization | Docker |
| Authentication | Django Authentication, Token Authentication |
| Package Management | npm, uv |

MySQL acts as the primary database, while Qdrant provides semantic retrieval capabilities.

## Database Design

The relational database consists of eight primary tables:

| Table | Description |
|-------|-------------|
| `Student` | Stores student information |
| `Staff` | Maintains staff and warden records |
| `Hostel` | Stores hostel block information |
| `Room` | Manages individual rooms and occupancy |
| `Preference` | Records student accommodation preferences |
| `Allocation` | Tracks room assignments and allocation history |
| `Complaint` | Stores maintenance complaints and resolution details |
| `Complaint_Vector_Outbox` | Tracks events requiring vector database synchronization |

### Database Concepts Implemented

HostelHub incorporates several database management concepts:

**Relational Integrity**
- Primary and foreign keys
- Unique constraints
- Check constraints
- Referential integrity

**Transactions and Concurrency**
- Atomic room allocation operations
- Transactional room vacation and reassignment
- Row-level locking
- Consistent occupancy updates

**Advanced SQL Features**
- Database triggers
- SQL views
- Joins and aggregate queries
- Indexing
- Transaction management

**Multi-Database Integration**
- Relational data storage using MySQL
- Vector similarity search using Qdrant
- Trigger-based outbox pattern
- Complaint synchronization and reconciliation

## Semantic Search

HostelHub uses semantic search to retrieve complaints based on meaning rather than exact words.

For example:

**Search Query**
```text
The ceiling fan is making strange noises.
```

**Related Complaint**
```text
The fan produces a rattling sound whenever it is switched on.
```

Although the descriptions use different wording, their semantic similarity allows Qdrant to identify them as related issues.

### Search Pipeline

1. A complaint is submitted through the application.
2. The complaint is stored in MySQL.
3. A MySQL trigger records a synchronization event.
4. The synchronization worker retrieves the complaint.
5. Sentence Transformers generates a 384-dimensional embedding.
6. The embedding is stored in Qdrant.
7. Search queries are converted into embeddings.
8. Qdrant performs cosine similarity search.
9. Matching complaint records are retrieved from MySQL.

The relational database remains the source of truth for complaint information.

## Project Structure

```text
hostelhub/
│
├── backend/
│   ├── config/
│   ├── core/
│   │   ├── management/
│   │   │   └── commands/
│   │   ├── models.py
│   │   ├── serializers.py
│   │   ├── services.py
│   │   ├── semantic.py
│   │   ├── views.py
│   │   └── urls.py
│   └── manage.py
│
├── frontend/
│   ├── app/
│   │   ├── dashboard/
│   │   ├── login/
│   │   ├── rooms/
│   │   ├── hostels/
│   │   ├── complaints/
│   │   └── api/
│   ├── components/
│   ├── lib/
│   └── package.json
│
├── pyproject.toml
├── uv.lock
└── README.md
```

## Getting Started

### Prerequisites

Ensure the following tools are installed:

- Python 3.12
- Node.js and npm compatible with the installed Next.js version
- Docker
- MySQL
- uv (Python package manager)

### 1. Clone the Repository

```bash
git clone https://github.com/ananya97br/hostelhub.git
cd hostelhub
```

### 2. Configure the Databases

HostelHub requires running MySQL and Qdrant instances.

Create or start the database containers and configure the Django database connection.

The application expects its relational tables and constraints to be initialized in MySQL. The hostel management schema is maintained separately from Django's built-in authentication migrations.

For an existing local setup with containers named `DBMS` and `hostelhub-qdrant`:

```bash
docker start DBMS hostelhub-qdrant
```

These commands assume the containers have already been created and configured.

Qdrant's local dashboard is available at:

```text
http://localhost:6333/dashboard
```

### 3. Configure the Django Backend

From the project root, install Python dependencies:

```bash
uv sync
```

Configure the backend environment variables in:

```text
backend/.env
```

Provide the appropriate MySQL connection settings and Qdrant configuration.

Example Qdrant settings:

```env
QDRANT_URL=http://127.0.0.1:6333
QDRANT_COLLECTION=hostelhub_complaints
```

Database credentials should be supplied through the application's existing environment configuration.

Apply Django migrations:

```bash
cd backend
uv run python manage.py migrate
```

Start the backend server:

```bash
uv run python manage.py runserver 127.0.0.1:8000
```

The Django backend runs at:

```text
http://127.0.0.1:8000
```

Django Admin is available at:

```text
http://127.0.0.1:8000/admin/
```

### 4. Configure the Next.js Frontend

Open another terminal:

```bash
cd frontend
npm install
```

Create a `.env.local` file inside the `frontend` directory.

Configure the Django API URL:

```env
DJANGO_API_URL=http://127.0.0.1:8000
```

Start the frontend:

```bash
npm run dev
```

Open the application at:

```text
http://localhost:3000
```

### 5. Create an Administrator Account

If an administrator account does not already exist, run:

```bash
cd backend
uv run python manage.py createsuperuser
```

Follow the prompts to configure the administrator credentials.

Student and warden accounts must be provisioned and linked to their corresponding records using the application's account-management functionality.

### 6. Synchronize Complaints with Qdrant

Run:

```bash
cd backend
uv run python manage.py sync_complaints
```

This processes complaint synchronization events and updates the corresponding vectors in Qdrant.

## Testing

### Backend

Run Django's system checks:

```bash
cd backend
uv run python manage.py check
```

Run the backend tests:

```bash
uv run python manage.py test core
```

### Frontend

Run TypeScript validation:

```bash
cd frontend
npx tsc --noEmit
```

Run the linter:

```bash
npm run lint
```

Verify the production build:

```bash
npm run build
```

## Security

HostelHub implements authentication and authorization for protected application functionality.

Security measures include:

- Django-based authentication
- Role-based API permissions
- Server-side handling of authentication tokens
- HTTP-only authentication cookies
- Input validation
- Database constraints
- Transactional updates

Environment files, database credentials, and authentication tokens should never be committed to the repository.

Production deployment requires appropriate HTTPS configuration, secure session handling, and restricted access to database services.

## Project Objective

HostelHub demonstrates the integration of traditional relational database management with vector-based information retrieval in a practical hostel administration application.

The project emphasizes database integrity, transaction management, role-based access, and efficient complaint retrieval through semantic similarity.
