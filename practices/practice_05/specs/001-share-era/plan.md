# Implementation Plan: Ссылка на эпоху
**Branch**: practice_05 | **Date**: 2026-10-28 | **Spec**: [spec.md](spec.md)

## Summary
Чистый codec URL и отдельный компонент копирования. Восстановление применяется только к результату соответствующего loadRepository. Точное время хранится отдельно от положения range, чтобы округление не меняло число коммитов.

## Technical Context
TypeScript strict, React 19, Next.js 16, Zod 4; существующие версии package-lock. Browser URLSearchParams/Clipboard; storage отсутствует. Vitest и Playwright CLI. Web desktop/mobile 360/768/1440. Кодек O(1), новых запросов кроме существующей загрузки нет; история до 1000 коммитов. Новых зависимостей нет.

## Constitution Check
I: предупреждение об актуальных данных; II: чистые функции и точные UTC; III: fallback копирования; IV: unit и браузерные проверки; V: whitelist query и область practice_05. До и после проектирования PASS.

## Project Structure
src/domain/era-link.ts — codec и ограничение даты.
src/components/share-era.tsx — действие копирования и fallback.
src/components/atlas.tsx — восстановление при загрузке и точная дата.
src/components/atlas.module.css — действия и форма.
tests/era-link.test.ts — контракты и границы.
Документы: research.md, data-model.md, contracts/url.md, quickstart.md, tasks.md.

## Design
Существующие paper/surface/forest, Literata/Golos Text. Действие рядом с таймлайном, пояснение слева, поле ссылки на всю доступную ширину; кнопки минимум 44px. Карта остаётся главным объектом. Проверка плана против brief: новых декоративных панелей нет, стиль проекта сохранён.

## Complexity Tracking
Нарушений нет. Go backend не меняется.
