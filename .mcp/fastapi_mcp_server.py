from __future__ import annotations
import httpx
from types import SimpleNamespace
from pathlib import Path
from mcp.server.fastmcp import FastMCP
from logger import logger
from src.utils.jjson import j_loads_ns
mcp = FastMCP('FastAPI-Media-Client')

from header import __root__
_CONFIG_PATH:Path = __root__ / '.mcp' / 'config.json'

def get_base_url() -> str:
    """Получение базового URL FastAPI-сервера из config.json."""
    try:
        cfg:SimpleNamespace = j_loads_ns(_CONFIG_PATH)
        if not cfg:
            logger.error(f'[fastapi_mcp_server] config.json пустой или не найден, fallback к localhost:8000')
            return ''
        
        server_cfg:SimpleNamespace = getattr(cfg, 'server')
        if not server_cfg:
            logger.error(f'[fastapi_mcp_server] Ошибка чтения server config в config.json, fallback к localhost:8000')
            return ''
        
        host:str = getattr(server_cfg, 'host')
        if not host:
            logger.error(f'[fastapi_mcp_server] Ошибка чтения host в config.json, fallback к localhost:8000')
            return ''      
        if host == '0.0.0.0':
            host = 'localhost' # <- принудительно 
        
        port:str = getattr(server_cfg, 'port') # <- у нас НЕТ дефолтового порта, он должен быть в config.json Мы мичего не хардкодим
        if not port:
            logger.error(f'[fastapi_mcp_server] Ошибка чтения port в config.json, fallback к localhost:8000')
            return ''   
        
        return f'http://{host}:{port}'
    except Exception as e:
        logger.error(f'[fastapi_mcp_server] Error чтения config.json, fallback к localhost:8000: {e}')
        return ''

base_url:str = get_base_url()    
if not base_url:
    logger.error(f'[fastapi_mcp_server] Ошибка получения базового URL FastAPI-сервера из config.json: {base_url}')
    raise Exception('config.json пустой или не найден')

@mcp.tool()
async def fastapi_chat(message: str) -> str:
    """Отправка сообщения в чат-роутер FastAPI backend."""
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(f'{get_base_url()}/api/chat', json={'message': message})
            return response.text
    except Exception as e:
        logger.error(f'[fastapi_mcp_server] Error fastapi_chat: {e}')
        return f'Error запроса к /api/chat: {e}'

@mcp.tool()
async def fastapi_media_list() -> str:
    """Получение списка медиафайлов из медиа-роутера FastAPI."""
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.get(f'{get_base_url()}/api/media')
            return response.text
    except Exception as e:
        logger.error(f'[fastapi_mcp_server] Error fastapi_media_list: {e}')
        return f'Error запроса к /api/media: {e}'

@mcp.tool()
async def fastapi_qbittorrent_info() -> str:
    """Получение информации о текущих торрентах из qBittorrent через FastAPI."""
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.get(f'{get_base_url()}/api/torrents')
            return response.text
    except Exception as e:
        logger.error(f'[fastapi_mcp_server] Error fastapi_qbittorrent_info: {e}')
        return f'Error запроса к /api/torrents: {e}'
if __name__ == '__main__':
    logger.info('[fastapi_mcp_server] Запуск FastAPI FastMCP сервера...')
    mcp.run()