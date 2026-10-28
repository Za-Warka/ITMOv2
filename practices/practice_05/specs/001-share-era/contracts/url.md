# URL contract
/?repo=owner%2Frepo&date=2024-01-01T00%3A00%3A00.000Z&tab=people&bots=1
Демо: repo=demo; culture — необязательный ключ известного языка. Неизвестная tab → chronicle, bots кроме 1 → false, culture → исходный demo. date валидируется Zod ISO datetime; невалидная игнорируется с notice. Некорректный repo проходит существующую валидацию и выдаёт ошибку, не становится demo.
Генератор использует origin и pathname, удаляет прежние query/hash. Ссылки не содержат headSha, auth или email. URL поля ручного копирования появляется только по нажатию. Все кнопки доступны с клавиатуры.
