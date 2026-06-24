import 'dotenv/config';
import './crawler-worker';
import './hf-worker';
import './scheduler-worker';

console.log('[Combined Worker] All workers (GitHub Crawler, HuggingFace Crawler, Scheduler, and Updaters) successfully loaded and running concurrently within a single process.');
