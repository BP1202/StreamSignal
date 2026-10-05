-- Enable PostGIS (includes spatial and geographic objects)
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;

-- Enable pgvector (vector data type and similarity search)
CREATE EXTENSION IF NOT EXISTS vector;

-- Enable UUID extension for primary keys and identifiers
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
