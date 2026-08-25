-- Banco separado para os testes de integração.
--
-- Separado de propósito: o teste de isolamento cross-tenant cria e apaga contas, e apontá-lo para o
-- mesmo banco do desenvolvimento significaria escolher entre um teste que suja os dados de trabalho
-- ou um teste que não limpa nada. Dois bancos resolvem isso sem nenhuma flag.
--
-- Roda uma única vez, na primeira criação do volume do Postgres (docker-entrypoint-initdb.d).
CREATE DATABASE batuta_test OWNER batuta;
