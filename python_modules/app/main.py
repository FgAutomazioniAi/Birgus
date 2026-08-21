from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.api.routes import router
from app.config import Settings
from app.modules.docx_engine.module import DocxEngineModule
from app.modules.langchain_orchestrator.module import LangchainOrchestratorModule
from app.modules.mail_engine.module import MailEngineModule
from app.modules.measure_report_engine.module import MeasureReportEngineModule
from app.modules.messaging_engine.module import MessagingEngineModule
from app.modules.ocr_engine.module import OcrEngineModule
from app.modules.registry import ModuleRegistry
from app.services.measure_report_engine_service import MeasureReportEngineService
from app.services.openai_compatible_lm_service import OpenAiCompatibleLmService
from app.services.paddle_ocr_service import PaddleOcrService
from app.services.quotation_docx_service import QuotationDocxService
from app.services.messaging_service import MessagingService
from app.services.smtp_mail_service import SmtpMailService
from app.services.storage_service import GarageStorageService


def build_module_registry(settings: Settings) -> ModuleRegistry:
    storage = GarageStorageService(settings)
    ocr_service = PaddleOcrService(settings)
    quotation_docx_service = QuotationDocxService()
    smtp_mail_service = SmtpMailService(settings)
    measure_report_engine_service = MeasureReportEngineService(settings)
    lm_service = OpenAiCompatibleLmService(settings)
    messaging_service = MessagingService(settings)

    modules = {
      "ocr_engine": OcrEngineModule(storage=storage, ocr=ocr_service),
      "docx_engine": DocxEngineModule(quotation_docx_service=quotation_docx_service),
      "mail_engine": MailEngineModule(smtp_mail_service=smtp_mail_service),
      "messaging_engine": MessagingEngineModule(messaging_service=messaging_service),
      "langchain_orchestrator": LangchainOrchestratorModule(lm_service=lm_service),
      "measure_report_engine": MeasureReportEngineModule(
          storage=storage,
          measure_report_engine_service=measure_report_engine_service,
      ),
    }

    return ModuleRegistry(modules)


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = Settings.from_env()
    registry = build_module_registry(settings)
    registry.warmup_all()
    app.state.module_registry = registry
    yield


app = FastAPI(
    title="Birgus Python Modules",
    version="1.0.0",
    lifespan=lifespan,
)
app.include_router(router)
