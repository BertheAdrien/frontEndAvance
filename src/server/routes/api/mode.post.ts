import { defineEventHandler } from 'h3';

import { changeLevelMode } from '../../mode';

export default defineEventHandler((event) => changeLevelMode(event));
