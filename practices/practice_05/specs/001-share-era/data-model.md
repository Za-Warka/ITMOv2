# Data model
EraLinkState: repo string|null (null=demo), date ISO UTC|undefined, tab chronicle|people|leaders|legend, includeBots boolean, culture known language|undefined (только demo).
readEraLink возвращает state и warnings. resolveEraDate возвращает точную ограниченную дату и notice; нулевой период допустим.
Atlas: position 0..1000 + exactDate nullable. seek/play очищает exactDate. Новый snapshot сбрасывает выделение и воспроизведение. Начатый позднее запрос отменяет восстановление прежнего.
