import './ui/styles.css';
import { Sync } from './state/sync.js';
import { startRouter } from './ui/router.js';

startRouter();
Sync.init();
