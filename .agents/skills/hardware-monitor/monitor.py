"""
Скрипт мониторинга оборудования через LibreHardwareMonitor
=========================================================

Опрашивает локальный сервер LibreHardwareMonitor (http://localhost:8085/data.json)
и выводит показатели температуры, мощности, напряжений и загрузки компонентов.
"""
from logger import logger
import json
import sys
import urllib.request
import urllib.error
from typing import Any, Dict, List, Optional
DEFAULT_LHM_URL = 'http://localhost:8085/data.json'

def fetch_lhm_data(url: str=DEFAULT_LHM_URL, timeout: float=3.0) -> Optional[Dict[str, Any]]:
    """
    Получает JSON-данные от веб-сервера LibreHardwareMonitor.
    """
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'AI-Windows-Admin/HardwareMonitor'})
        with urllib.request.urlopen(req, timeout=timeout) as response:
            return json.loads(response.read().decode('utf-8'))
    except Exception as e:
        return None

def _traverse_tree(node: Dict[str, Any], path: Optional[List[str]]=None) -> List[Dict[str, Any]]:
    """
    Рекурсивно обходит дерево сенсоров LHM.
    """
    if path is None:
        path = []
    results = []
    text = node.get('Text', '')
    val = node.get('Value', '')
    min_v = node.get('Min', '')
    max_v = node.get('Max', '')
    children = node.get('Children', [])
    current_path = path + [text] if text else path
    if val:
        results.append({'name': text, 'path': current_path, 'value': val, 'min': min_v, 'max': max_v})
    for child in children:
        results.extend(_traverse_tree(child, current_path))
    return results

def get_all_sensors(url: str=DEFAULT_LHM_URL) -> List[Dict[str, Any]]:
    """Возвращает плоский список всех сенсоров."""
    data = fetch_lhm_data(url)
    if not data:
        return []
    return _traverse_tree(data)

def get_cpu_info(url: str=DEFAULT_LHM_URL) -> Dict[str, Any]:
    """Возвращает подробные метрики CPU (температуры, частоты, мощности, напряжения)."""
    sensors = get_all_sensors(url)
    cpu_data = {'model': 'Unknown CPU', 'temperatures': {}, 'clocks': {}, 'powers': {}, 'voltages': {}, 'load': {}}
    for s in sensors:
        path = s['path']
        name = s['name']
        val = s['value']
        if any(('Core i' in p or 'Intel' in p or 'AMD' in p or ('Ryzen' in p) for p in path)):
            if len(path) >= 3 and cpu_data['model'] == 'Unknown CPU':
                cpu_data['model'] = path[2]
            if 'Temperatures' in path and 'TjMax' not in name:
                cpu_data['temperatures'][name] = {'value': val, 'min': s['min'], 'max': s['max']}
            elif 'Clocks' in path:
                cpu_data['clocks'][name] = val
            elif 'Powers' in path:
                cpu_data['powers'][name] = val
            elif 'Voltages' in path:
                cpu_data['voltages'][name] = val
            elif 'Load' in path:
                cpu_data['load'][name] = val
    return cpu_data

def get_gpu_info(url: str=DEFAULT_LHM_URL) -> Dict[str, Any]:
    """Возвращает метрики GPU."""
    sensors = get_all_sensors(url)
    gpu_data = {'model': 'Unknown GPU', 'temperatures': {}, 'load': {}, 'clocks': {}, 'powers': {}}
    for s in sensors:
        path = s['path']
        name = s['name']
        val = s['value']
        if any(('NVIDIA' in p or 'GeForce' in p or 'Radeon' in p or ('Intel Iris' in p) or ('Intel UHD' in p) for p in path)):
            if len(path) >= 3 and gpu_data['model'] == 'Unknown GPU':
                gpu_data['model'] = path[2]
            if 'Temperatures' in path:
                gpu_data['temperatures'][name] = {'value': val, 'min': s['min'], 'max': s['max']}
            elif 'Load' in path:
                gpu_data['load'][name] = val
            elif 'Clocks' in path:
                gpu_data['clocks'][name] = val
            elif 'Powers' in path:
                gpu_data['powers'][name] = val
    return gpu_data

def print_cpu_summary(cpu: Dict[str, Any]):
    """Форматированный вывод показателей CPU."""
    logger.console(f"\n🖥️  Процессор: {cpu['model']}")
    logger.console('-' * 50)
    logger.console('🌡️  Температуры:')
    for k, v in cpu['temperatures'].items():
        logger.console(f"   • {k:<20}: {v['value']:<10} (Min: {v['min']}, Max: {v['max']})")
    if cpu['powers']:
        logger.console('\n⚡ Мощность:')
        for k, v in cpu['powers'].items():
            logger.console(f'   • {k:<20}: {v}')
    if cpu['clocks']:
        logger.console('\n⏱️  Частоты:')
        for k, v in list(cpu['clocks'].items())[:6]:
            logger.console(f'   • {k:<20}: {v}')

def main():
    mode = sys.argv[1].lower() if len(sys.argv) > 1 else 'all'
    cpu = get_cpu_info()
    gpu = get_gpu_info()
    if not cpu['temperatures'] and (not gpu['temperatures']):
        logger.console('❌ Ошибка: Не удалось получить данные от LibreHardwareMonitor.')
        logger.console('Убедитесь, что приложение LibreHardwareMonitor запущено и в меню включен веб-сервер:')
        logger.console('  Options -> Remote Web Server -> Run (порт 8085)')
        sys.exit(1)
    if mode in ['--json', '-j']:
        logger.console(json.dumps({'cpu': cpu, 'gpu': gpu}, indent=2, ensure_ascii=False))
        return
    if mode in ['cpu', 'temp', 'temperature']:
        print_cpu_summary(cpu)
    elif mode == 'gpu':
        logger.console(f"\n🎮 Видеокарта: {gpu['model']}")
        logger.console('-' * 50)
        logger.console('🌡️  Температуры:')
        for k, v in gpu['temperatures'].items():
            logger.console(f"   • {k:<20}: {v['value']:<10} (Min: {v['min']}, Max: {v['max']})")
        if gpu['load']:
            logger.console('\n📊 Загрузка:')
            for k, v in gpu['load'].items():
                logger.console(f'   • {k:<20}: {v}')
    else:
        print_cpu_summary(cpu)
        if gpu['temperatures']:
            logger.console(f"\n🎮 Видеокарта: {gpu['model']}")
            logger.console('-' * 50)
            logger.console('🌡️  Температуры:')
            for k, v in gpu['temperatures'].items():
                logger.console(f"   • {k:<20}: {v['value']:<10} (Min: {v['min']}, Max: {v['max']})")
if __name__ == '__main__':
    main()