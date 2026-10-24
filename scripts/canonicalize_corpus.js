import { POETRY_DATABASE } from '../src/data/poetry_db.js';
import { writeSingleSourceCorpus } from './lib/write_single_source_corpus.js';
writeSingleSourceCorpus(POETRY_DATABASE);
