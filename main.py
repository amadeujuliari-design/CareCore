# =====================================================================
# ARQUIVO: main.py
# =====================================================================

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from fastapi.exceptions import RequestValidationError
import contextlib
import os
import re

from database import engine, Base
from licenciamento import middleware_licenciamento

from routers import usuarios
from routers import auth
from routers import quartos
from routers import conviventes
from routers import avisos
from routers import arquivos


ORIGENS_PERMITIDAS = {
    "http://localhost:5173",
    "http://127.0.0.1:5173",
}
ORIGEM_LAN_REGEX = r"^http://(192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}):5173$"

APP_ENV = os.getenv("APP_ENV", "local").strip().lower()
AUTO_CREATE_TABLES_PADRAO = "true" if APP_ENV in {"local", "development", "dev"} else "false"
AUTO_CREATE_TABLES = os.getenv("CARECORE_AUTO_CREATE_TABLES", AUTO_CREATE_TABLES_PADRAO).strip().lower() in {
    "1",
    "true",
    "yes",
    "sim",
}


@contextlib.asynccontextmanager
async def lifespan(app: FastAPI):
    if AUTO_CREATE_TABLES:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

    yield


app = FastAPI(
    title="CARECORE+ API",
    lifespan=lifespan
)

# =====================================================================
# MIDDLEWARE LICENÇA
# =====================================================================

app.middleware("http")(middleware_licenciamento)

# =====================================================================
# CORS PADRÃO
# =====================================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=list(ORIGENS_PERMITIDAS),
    allow_origin_regex=ORIGEM_LAN_REGEX,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =====================================================================
# CORS DE SEGURANÇA — RESOLVE PREFLIGHT/RETORNOS SEM HEADER
# =====================================================================

@app.middleware("http")
async def cors_seguro_carecore(request: Request, call_next):
    origin = request.headers.get("origin")

    if request.method == "OPTIONS":
        response = Response(status_code=204)
    else:
        response = await call_next(request)

    if origin in ORIGENS_PERMITIDAS or (origin and re.match(ORIGEM_LAN_REGEX, origin)):
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, PATCH, DELETE, OPTIONS"
        response.headers["Access-Control-Allow-Headers"] = "Authorization, Content-Type, Accept, Origin"
        response.headers["Vary"] = "Origin"

    return response


# =====================================================================
# HANDLER VALIDAÇÃO
# =====================================================================

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(
    request: Request,
    exc: RequestValidationError
):
    erros = []

    for erro in exc.errors():
        erros.append({
            "campo": ".".join([str(x) for x in erro["loc"]]),
            "mensagem": erro["msg"]
        })

    return JSONResponse(
        status_code=422,
        content={
            "detail": "Erro de validação.",
            "erros": erros
        }
    )


# =====================================================================
# UPLOADS
# =====================================================================

os.makedirs("uploads/documentos", exist_ok=True)


# =====================================================================
# ROTAS
# =====================================================================

app.include_router(auth.router)
app.include_router(arquivos.router)
app.include_router(quartos.router)
app.include_router(conviventes.router)
app.include_router(avisos.router)
app.include_router(usuarios.router)

