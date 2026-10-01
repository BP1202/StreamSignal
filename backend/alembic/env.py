import os
import sys
from logging.config import fileConfig

from sqlalchemy import engine_from_config
from sqlalchemy import pool

from alembic import context

# Ensure the backend directory is in sys.path
sys.path.insert(
    0,
    os.path.abspath(
        os.path.join(os.path.dirname(__file__), "..")
    )
)

from app.core.config import get_settings
from app.core.database import Base
import app.models  # noqa: F401

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# Interpret the config file for Python logging.
# This line sets up loggers basically.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# add your model's MetaData object here
# for 'autogenerate' support
target_metadata = Base.metadata

# Inject the dynamic database URL from application settings into Alembic config
settings = get_settings()
config.set_main_option(
    "sqlalchemy.url",
    settings.DATABASE_URL.replace("%", "%%")
)


def include_object(object, name, type_, reflected, compare_to):
    """
    Exclude PostGIS and Tiger spatial extension tables from migrations.
    This ensures Alembic does not attempt to drop or alter database extension tables.
    """
    if type_ == "table" and name in [
        "spatial_ref_sys",
        "geometry_columns",
        "geography_columns",
        "raster_columns",
        "raster_overviews",
    ]:
        return False

    schema = getattr(object, "schema", None)
    if schema in ["tiger", "topology", "tiger_data"]:
        return False

    if type_ == "table" and (
        name.startswith("tiger")
        or name.startswith("pagc_")
        or name in [
            "addr", "addrfeat", "bg", "county", "county_lookup", "cousub",
            "countysub_lookup", "direction_lookup", "edges", "faces",
            "featnames", "geocode_settings", "geocode_settings_default",
            "layer", "loader_lookuptables", "loader_platform", "loader_variables",
            "place", "place_lookup", "secondary_unit_lookup", "state",
            "state_lookup", "street_type_lookup", "tabblock", "tabblock20",
            "topology", "tract", "zcta5", "zip_lookup", "zip_lookup_all",
            "zip_lookup_base", "zip_state", "zip_state_loc"
        ]
    ):
        return False

    return True


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        include_object=include_object,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            include_object=include_object,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
