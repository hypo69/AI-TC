# -*- coding: utf-8 -*-
# =============================================================================
# Process Name: AI-Windows-Admin Apps Windows Api Routers - models
# =============================================================================
# Description:
#   Pydantic-модели ответов и запросов панели «О системе».
#   Вынесено из router_about_system.py (этап 4 оптимизации).
#
# File: models.py
# Project: ai-windows-admin
# Package: apps.windows.api.routers.about_system
# Author: hypo69
# Copyright: c 2026 hypo69
# Updated: 2026-10-12 06:20:00
# =============================================================================

from __future__ import annotations

import os
from typing import (
    Any,
    Dict,
    List,
    Optional,
)

from pydantic import BaseModel, Field


class PlatformOsPanelResponse(BaseModel):
    """Модель ответа панели «Платформа & ОС»."""
    status: str = Field(default="ok", description="Статус ответа")
    os_name: str = Field(default="Windows", description="Наименование операционной системы")
    os_build: str = Field(default="", description="Номер сборки ОС")
    os_install_date: str = Field(default="", description="Дата установки операционной системы")
    architecture: str = Field(default="x86_64", description="Архитектура процессора")
    hostname: str = Field(default="", description="Имя хоста")
    workgroup: str = Field(default="WORKGROUP", description="Рабочая группа (Workgroup) или домен")
    uptime_seconds: float = Field(default=0.0, description="Аптайм в секундах")
    uptime_human: str = Field(default="0h 0m", description="Человекочитаемый аптайм")
    display_title: str = Field(default="Windows", description="Заголовок для KPI-карточки")
    display_host: str = Field(default="Host: --", description="Строка с именем хоста")
    display_workgroup: str = Field(default="Workgroup: WORKGROUP", description="Строка с рабочей группой")
    timestamp: str = Field(default="", description="Временная метка последнего зафиксированного снимка")


class SecurityPanelResponse(BaseModel):
    """Модель ответа панели «Безопасность системы»."""
    status: str = Field(default="Active & Protected", description="Сводный статус защиты")
    firewall_status: str = Field(default="ON", description="Статус брандмауэра")
    firewall_domain: bool = Field(default=True, description="Брандмауэр доменного профиля")
    firewall_private: bool = Field(default=True, description="Брандмауэр частного профиля")
    firewall_public: bool = Field(default=True, description="Брандмауэр публичного профиля")
    defender_enabled: bool = Field(default=True, description="Защитник Windows включен")
    realtime_protection: bool = Field(default=True, description="Режим защиты в реальном времени")
    uac_enabled: bool = Field(default=True, description="Контроль учетных записей (UAC) активен")
    display_title: str = Field(default="Active & Protected", description="Заголовок для KPI-карточки")
    display_subtitle: str = Field(default="Firewall: ON | UAC: ON", description="Подзаголовок для KPI-карточки")
    timestamp: str = Field(default="", description="Временная метка аудита")


class RestorePointsPanelResponse(BaseModel):
    """Модель ответа панели «Точки восстановления»."""
    status: str = Field(default="ok", description="Статус ответа")
    checkpoints_count: int = Field(default=0, description="Количество доступных точек восстановления")
    protection_enabled: bool = Field(default=True, description="Защита системы включена")
    protection_status: str = Field(default="Active", description="Текстовый статус защиты")
    display_title: str = Field(default="0 Checkpoints", description="Заголовок для KPI-карточки")
    display_subtitle: str = Field(default="Protection: Active", description="Подзаголовок для KPI-карточки")
    latest_checkpoint_name: Optional[str] = Field(default=None, description="Имя последней контрольной точки")
    latest_checkpoint_time: Optional[str] = Field(default=None, description="Время последней контрольной точки")
    timestamp: str = Field(default="", description="Временная метка аудита")


class StoragePanelResponse(BaseModel):
    """Модель ответа панели «Системный накопитель (C:)»."""
    status: str = Field(default="ok", description="Статус ответа")
    drive: str = Field(default="C:", description="Буква системного диска")
    total_gb: float = Field(default=0.0, description="Общий объем системного диска в GB")
    free_gb: float = Field(default=0.0, description="Свободный объем системного диска в GB")
    used_gb: float = Field(default=0.0, description="Занятый объем системного диска в GB")
    percent_used: float = Field(default=0.0, description="Процент использования диска")
    cleanable_mb: float = Field(default=0.0, description="Оценка объема файлов для очистки в MB")
    display_title: str = Field(default="0.0 GB Free", description="Заголовок для KPI-карточки")
    display_subtitle: str = Field(default="Cleanable: ~0 MB", description="Подзаголовок для KPI-карточки")
    timestamp: str = Field(default="", description="Временная метка последнего снимка")


class CpuPanelResponse(BaseModel):
    """Модель ответа виджета «Загрузка CPU»."""
    total_percent: float = Field(default=0.0, description="Загрузка CPU в процентах")
    frequency_mhz: float = Field(default=0.0, description="Текущая частота CPU в МГц")
    physical_cores: int = Field(default=6, description="Количество физических ядер")
    logical_cores: int = Field(default=12, description="Количество логических потоков")
    model: str = Field(default="Intel Processor", description="Модель процессора")
    display_val: str = Field(default="0.0%", description="Отображаемое значение загрузки")
    display_cores: str = Field(default="6 физ. / 12 Потоков", description="Строка с ядрами и потоками")
    display_freq: str = Field(default="", description="Строка с частотой")


class MemoryPanelResponse(BaseModel):
    """Модель ответа виджета «Память (RAM)»."""
    total_gb: float = Field(default=0.0, description="Общий объем памяти в GB")
    used_gb: float = Field(default=0.0, description="Занятый объем памяти в GB")
    available_gb: float = Field(default=0.0, description="Свободный объем памяти в GB")
    percent: float = Field(default=0.0, description="Процент занятой памяти")
    display_val: str = Field(default="0.0 / 0.0 GB", description="Отображаемая строка памяти")
    display_sub: str = Field(default="0.0% занято (0.0 GB свободно)", description="Подзаголовок памяти")


class GpuPanelResponse(BaseModel):
    """Модель ответа виджета «GPU Ускоритель»."""
    name: str = Field(default="GPU", description="Наименование графического ускорителя")
    memory_total_gb: float = Field(default=0.0, description="Объем VRAM в GB")
    load_percent: float = Field(default=0.0, description="Процент нагрузки GPU")
    temperature_c: Optional[float] = Field(default=None, description="Температура GPU в °C")
    badge: str = Field(default="Active GPU", description="Бейдж возможностей (CUDA, DirectML)")
    display_name: str = Field(default="GPU", description="Отображаемое имя GPU")
    display_vram: str = Field(default="VRAM: N/A", description="Подзаголовок с объемом памяти и нагрузкой")


class DiskIoPanelResponse(BaseModel):
    """Модель ответа виджета «Диск (C:) I/O»."""
    read_bytes_sec: float = Field(default=0.0, description="Скорость чтения байт/с")
    write_bytes_sec: float = Field(default=0.0, description="Скорость записи байт/с")
    total_mb_s: float = Field(default=0.0, description="Суммарная скорость в MB/s")
    read_kb_s: float = Field(default=0.0, description="Скорость чтения в KB/s")
    write_kb_s: float = Field(default=0.0, description="Скорость записи в KB/s")
    display_val: str = Field(default="0.00 MB/s", description="Отображаемая скорость")
    display_rates: str = Field(default="Чтение: 0 КБ/с | Запись: 0 КБ/с", description="Подзаголовок со скоростями чтения/записи")


class AboutSystemHistoryItem(BaseModel):
    """Элемент исторического среза телеметрии из таблицы system_snapshots."""
    id: int = Field(..., description="Идентификатор записи в базе данных")
    timestamp: str = Field(..., description="Временная метка ISO")
    created_at: Optional[float] = Field(default=None, description="UNIX timestamp")
    hostname: str = Field(default="", description="Имя хоста")
    uptime_seconds: float = Field(default=0.0, description="Аптайм в секундах")
    uptime_human: str = Field(default="0h 0m", description="Человекочитаемый аптайм")
    os_name: str = Field(default="Windows", description="Операционная система")
    os_build: str = Field(default="", description="Сборка ОС")
    os_install_date: Optional[str] = Field(default=None, description="Дата установки ОС")
    cpu_total_percent: float = Field(default=0.0, description="Загрузка CPU (%)")
    cpu_frequency_mhz: float = Field(default=0.0, description="Частота CPU (МГц)")
    memory_total_gb: float = Field(default=0.0, description="Всего RAM (GB)")
    memory_used_gb: float = Field(default=0.0, description="Занято RAM (GB)")
    memory_percent: float = Field(default=0.0, description="Процент памяти (%)")
    gpu_load_percent: float = Field(default=0.0, description="Нагрузка GPU (%)")
    gpu_temp_c: Optional[float] = Field(default=None, description="Температура GPU (°C)")
    disk_read_bytes_sec: float = Field(default=0.0, description="Чтение диска (байт/с)")
    disk_write_bytes_sec: float = Field(default=0.0, description="Запись диска (байт/с)")
    disk_io_total_mb_s: float = Field(default=0.0, description="Суммарная скорость диска (MB/s)")
    storage_c_free_gb: Optional[float] = Field(default=None, description="Свободно на C: (GB)")
    storage_c_used_gb: Optional[float] = Field(default=None, description="Занято на C: (GB)")
    storage_c_total_gb: Optional[float] = Field(default=None, description="Объем C: (GB)")


class AboutSystemHistoryResponse(BaseModel):
    """Ответ с историей метрик панели 'О Системе' из telemetry.db."""
    status: str = Field(default="ok", description="Статус ответа")
    count: int = Field(default=0, description="Количество возвращенных записей")
    metric: str = Field(default="all", description="Запрошенный фильтр метрики")
    history: List[AboutSystemHistoryItem] = Field(default_factory=list, description="Список исторических снимков")
    meta: Dict[str, Any] = Field(default_factory=dict, description="Метаданные запроса к базе данных")


class AboutSystemPanelOverviewResponse(BaseModel):
    """Сводный ответ для всей панели 'О Системе' (8 карточек и метаданные) из базы данных telemetry.db."""
    status: str = Field(default="ok", description="Статус ответа")
    os: PlatformOsPanelResponse = Field(default_factory=PlatformOsPanelResponse, description="Карточка 1: Платформа & ОС")
    security: SecurityPanelResponse = Field(default_factory=SecurityPanelResponse, description="Карточка 2: Безопасность")
    restore_points: RestorePointsPanelResponse = Field(default_factory=RestorePointsPanelResponse, description="Карточка 3: Точки восстановления")
    storage: StoragePanelResponse = Field(default_factory=StoragePanelResponse, description="Карточка 4: Системный накопитель C:")
    cpu: CpuPanelResponse = Field(default_factory=CpuPanelResponse, description="Карточка 5: Загрузка CPU")
    memory: MemoryPanelResponse = Field(default_factory=MemoryPanelResponse, description="Карточка 6: Память (RAM)")
    gpu: GpuPanelResponse = Field(default_factory=GpuPanelResponse, description="Карточка 7: GPU Ускоритель")
    disk_io: DiskIoPanelResponse = Field(default_factory=DiskIoPanelResponse, description="Карточка 8: Диск (C:) I/O")
    meta: Dict[str, Any] = Field(default_factory=dict, description="Метаданные сформированного SQL-запроса к telemetry.db")


class RenameComputerRequest(BaseModel):
    """Модель запроса на переименование компьютера."""
    new_name: str = Field(..., min_length=1, max_length=15, description="Новое имя компьютера (до 15 символов, без спецсимволов)")
    restart: bool = Field(default=False, description="Флаг немедленной перезагрузки компьютера")


class RenameComputerResponse(BaseModel):
    """Модель ответа на переименование компьютера."""
    status: str = Field(default="ok", description="Статус выполнения (ok/error)")
    old_name: str = Field(default="", description="Предыдущее имя компьютера")
    new_name: str = Field(default="", description="Новое имя компьютера")
    message: str = Field(default="", description="Информационное сообщение")
    restart_scheduled: bool = Field(default=False, description="Запланирована ли перезагрузка")


class ChangeWorkgroupRequest(BaseModel):
    """Модель запроса на изменение рабочей группы."""
    new_workgroup: str = Field(..., min_length=1, max_length=15, description="Новое имя рабочей группы (до 15 символов, без спецсимволов)")
    restart: bool = Field(default=False, description="Флаг немедленной перезагрузки компьютера")


class ChangeWorkgroupResponse(BaseModel):
    """Модель ответа на изменение рабочей группы."""
    status: str = Field(default="ok", description="Статус выполнения (ok/error)")
    old_workgroup: str = Field(default="", description="Предыдущее имя рабочей группы")
    new_workgroup: str = Field(default="", description="Новое имя рабочей группы")
    message: str = Field(default="", description="Информационное сообщение")
    restart_scheduled: bool = Field(default=False, description="Запланирована ли перезагрузка")


class TimezoneOption(BaseModel):
    """Модель варианта часового пояса Windows."""
    id: str = Field(..., description="Системный ID часового пояса (например: 'Israel Standard Time', 'Russian Standard Time')")
    display_name: str = Field(..., description="Отображаемое имя (например: '(UTC+02:00) Jerusalem')")
    offset_minutes: int = Field(default=0, description="Смещение от UTC в минутах")


class LocaleOption(BaseModel):
    """Модель варианта локали."""
    code: str = Field(..., description="Код локали (ru-RU, en-US, he-IL, de-DE, etc.)")
    name: str = Field(..., description="Название языка и региона")


class RegionalOptionsResponse(BaseModel):
    """Модель ответа списка доступных региональных параметров хоста."""
    status: str = Field(default="ok", description="Статус ответа")
    current_timezone: str = Field(default="", description="Текущий ID часового пояса")
    current_timezone_name: str = Field(default="", description="Текущее отображаемое имя часового пояса")
    current_system_locale: str = Field(default="", description="Текущая системная локаль")
    current_user_locale: str = Field(default="", description="Текущая пользовательская локаль")
    current_username: str = Field(default="", description="Текущий пользователь")
    current_user_fullname: str = Field(default="", description="Полное имя пользователя")
    current_user_description: str = Field(default="", description="Описание пользователя")
    current_codepage: str = Field(default="UTF-8 (65001)", description="Текущая кодовая страница")
    timezones: List[TimezoneOption] = Field(default_factory=list, description="Список доступных часовых поясов")
    locales: List[LocaleOption] = Field(default_factory=list, description="Список распространенных локалей")


class SetTimezoneRequest(BaseModel):
    """Запрос на изменение системного часового пояса."""
    timezone_id: str = Field(..., min_length=1, max_length=120, description="ID часового пояса из tzutil / Set-TimeZone")


class SetTimezoneResponse(BaseModel):
    """Ответ на изменение системного часового пояса."""
    status: str = Field(default="ok", description="Статус операции (ok/error)")
    old_timezone: str = Field(default="", description="Предыдущий часовой пояс")
    new_timezone: str = Field(default="", description="Установленный часовой пояс")
    message: str = Field(default="", description="Информационное сообщение")


class SetLocaleRequest(BaseModel):
    """Запрос на изменение системной и/или пользовательской локали."""
    system_locale: str = Field(..., min_length=2, max_length=20, description="Тег системной локали (например: ru-RU, en-US)")
    user_locale: Optional[str] = Field(default=None, description="Тег пользовательской локали")


class SetLocaleResponse(BaseModel):
    """Ответ на изменение локали."""
    status: str = Field(default="ok", description="Статус операции (ok/error)")
    system_locale: str = Field(default="", description="Установленная системная локаль")
    message: str = Field(default="", description="Информационное сообщение")
    restart_required: bool = Field(default=True, description="Требуется ли перезагрузка/перезаход для применения")


class UpdateUserProfileRequest(BaseModel):
    """Запрос на обновление информации локального пользователя."""
    username: str = Field(default="", description="Имя учетной записи (если пусто - текущий пользователь)")
    full_name: Optional[str] = Field(default=None, description="Полное имя пользователя")
    description: Optional[str] = Field(default=None, description="Описание учетной записи")


class UpdateUserProfileResponse(BaseModel):
    """Ответ на обновление информации пользователя."""
    status: str = Field(default="ok", description="Статус операции (ok/error)")
    username: str = Field(default="", description="Имя пользователя")
    message: str = Field(default="", description="Информационное сообщение")
