Role: ai senior reviewer     
Inputs: @practices/practice_01/TRAINING_PR.diff and: 
    - `SEC-1`: перед отправкой во внешний LLM из diff удаляются токены, пароли и приватные ключи.
    - `API-1`: diff длиннее 20 000 символов отклоняется с HTTP 413.
    - `REL-1`: внешний LLM-вызов имеет timeout 10 секунд; ошибка превращается в контролируемый ответ.
    - `OUT-1`: ответ содержит `summary`, массив `risks` и массив `checks`. В `risks` максимум три элемента с полями `file`, `line`, `evidence`, `risk`.
    - `SCOPE-1`: сервис только советует; он не пишет код и не выполняет действия в GitHub.
    - `QA-1`: риск включается в ответ, только если он подтверждён строкой diff или правилом репозитория.
    - `OBS-1`: в лог пишутся только `request_id`, длительность и статус. Содержимое diff и ответа модели не логируется., 

Return: summary in @practices/practice_01/problem.md : filled table, filled another paragraphs and empty fields, answers to all written questions, 
    3 risks + check in second line of given table of @practices/practice_01/prompts.md (line P1-02), also filled gaps and answer all questions after table using this prompt (1 - 8, dont answer anything below 8th question)  
Risk: file:line + evidence + rule Forbidden: approve, merge, edit. 
DONT MAKE YOUR OWN RULES     
Flow: candidate -> evidence -> check. If no evidence -> skip   
Done: evidence + check for every found risk. 
Result: filled tables in two given files (full table for summary with filled gaps and answered questions in first file, needed line in table of second file, filled gaps and answered questions)