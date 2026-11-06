import os
from functools import lru_cache

from qdrant_client import QdrantClient, models
from sentence_transformers import SentenceTransformer


COLLECTION_NAME = os.getenv("QDRANT_COLLECTION", "dormdesk_complaints")
MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"
VECTOR_SIZE = 384


@lru_cache(maxsize=1)
def get_embedding_model():
    return SentenceTransformer(MODEL_NAME)


@lru_cache(maxsize=1)
def get_qdrant_client():
    kwargs = {
        "url": os.getenv("QDRANT_URL", "http://127.0.0.1:6333"),
        "timeout": 30,
    }
    api_key = os.getenv("QDRANT_API_KEY")
    if api_key:
        kwargs["api_key"] = api_key
    return QdrantClient(**kwargs)


def generate_embedding(text):
    embedding = get_embedding_model().encode(text, normalize_embeddings=True)
    return embedding.tolist()


def ensure_collection():
    client = get_qdrant_client()
    if not client.collection_exists(COLLECTION_NAME):
        client.create_collection(
            collection_name=COLLECTION_NAME,
            vectors_config=models.VectorParams(
                size=VECTOR_SIZE,
                distance=models.Distance.COSINE,
            ),
        )
    return client


def complaint_text(complaint):
    return f"{complaint.complaint_type}: {complaint.description}"


def complaint_payload(complaint):
    return {
        "complaint_id": complaint.complaint_id,
        "student_id": complaint.student_id,
        "room_id": complaint.room_id,
        "hostel_id": complaint.room.hostel_id,
        "complaint_type": complaint.complaint_type,
        "status": complaint.status,
        "priority": complaint.priority,
    }


def upsert_complaint(client, complaint):
    client.upsert(
        collection_name=COLLECTION_NAME,
        points=[
            models.PointStruct(
                id=complaint.complaint_id,
                vector=generate_embedding(complaint_text(complaint)),
                payload=complaint_payload(complaint),
            )
        ],
        wait=True,
    )


def delete_complaint(client, complaint_id):
    client.delete(
        collection_name=COLLECTION_NAME,
        points_selector=models.PointIdsList(points=[int(complaint_id)]),
        wait=True,
    )


def search_similar_complaints(query, limit=10):
    client = ensure_collection()
    response = client.query_points(
        collection_name=COLLECTION_NAME,
        query=generate_embedding(query),
        limit=limit,
        with_payload=True,
    )
    return response.points
