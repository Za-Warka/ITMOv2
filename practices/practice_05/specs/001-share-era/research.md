# Research — speckit-plan
Decision: UTC ISO с миллисекундами и отдельная override-дата. Rationale: положение 0..1000 теряет точность; обратное вычисление float может сдвинуть границу коммита. Alternative: сохранять только положение — отклонено.
Decision: применить восстановление в обработчике result с тем же requestId; демо восстанавливать без загрузки. Alternative: общий effect по snapshot — может перезаписать пользовательский выбор.
Decision: whitelist query и allowlist культуры. Rationale: не переносить секреты/посторонние параметры.
Decision: readOnly input при любом отказе Clipboard; не использовать устаревший execCommand.
Evidence: локальный Next.js use-client guide; исследование atlas.tsx, fixture и нормализации parseRepository.
