import * as path from 'path';
import * as fs from 'fs-extra';
import * as crypto from 'crypto';
import ffmpeg from 'fluent-ffmpeg';
import { TRANSCODE_PATH } from "../app";
import { getCombinedMetadata } from "../utils/media-utils";

const sessions = new Map();
const SEGMENT_DURATION = 10; // seconds per segment
const BUFFER_SEGMENTS = 3; // x times segment_duration for extra buffer