/** 无损压缩兼容入口。 */
import { POETRY_DATABASE } from '../src/data/poetry_db.js';
import { writeCorpus } from './lib/write_corpus.js';
writeCorpus(POETRY_DATABASE);
