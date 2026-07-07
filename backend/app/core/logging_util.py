import logging
import contextvars

request_id_ctx = contextvars.ContextVar("request_id", default="-")

class RequestIdFilter(logging.Filter):
    def filter(self, record):
        record.request_id = request_id_ctx.get()
        return True

def setup_logging():
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] [ReqID: %(request_id)s] %(name)s: %(message)s",
        handlers=[logging.StreamHandler()]
    )
    # Add filter to root logger
    for handler in logging.getLogger().handlers:
        handler.addFilter(RequestIdFilter())
    
    logging.getLogger("uvicorn").setLevel(logging.INFO)
    logging.getLogger("uvicorn.error").setLevel(logging.INFO)
    logging.getLogger("uvicorn.access").setLevel(logging.INFO)
