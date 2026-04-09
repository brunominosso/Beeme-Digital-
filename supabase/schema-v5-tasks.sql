-- schema-v5-tasks.sql
-- Adiciona suporte a tarefas recorrentes

-- recurrence: null = pontual, 'weekly:1,2,3' = repete toda Segunda(1), Terça(2), Quarta(3)
-- Dias: 0=Dom, 1=Seg, 2=Ter, 3=Qua, 4=Qui, 5=Sex, 6=Sáb
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS recurrence text;
