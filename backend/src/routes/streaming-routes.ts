import { Router, Request, Response } from 'express';
import streamingService from "../services/streaming-service";
import { logger } from "../logger";
import { findMediaFileById } from "../utils/media-utils";
import { pathExists, stat } from "../utils/file-utils";
import fs from "fs";
import clientManager from "../services/client-manager";
import { spawn } from "child_process";
import transcodeDecisionService from "../services/transcode-decision";

const router = Router();

// router.get('/api/playback/:id/:quality/start', async (req: Request, res: Response) => {
//     try {
//         const { id, quality } = req.params;
//         const token = req.headers['x-client-token'] as string || req.query.token as string;
//
//         if (!token) {
//             return res.status(401).json({ error: 'No client token provided' });
//         }
//
//         // Get media file
//         const file = await findMediaFileById(id);
//         if (!file) {
//             return res.status(404).json({ error: 'Media file not found' });
//         }
//
//         if (!await pathExists(file.path)) {
//             return res.status(404).json({ error: 'Media file does not exist on disk' });
//         }
//
//         // Get client capabilities
//         const client = clientManager.getClient(token);
//         if (!client) {
//             return res.status(401).json({ error: 'Invalid client token' });
//         }
//
//         // Determine playback mode
//         let mode: 'direct_play' | 'direct_remux' | 'transcode';
//         let decision;
//
//         if (quality === 'original') {
//             // For "original", check if we can do direct play or need transcoding
//             decision = transcodeDecisionService.decide(file, client.capabilities);
//             mode = decision.mode as 'direct_play' | 'direct_remux' | 'transcode';
//         } else {
//             // For specific quality presets, always transcode
//             // But still make decision for metadata
//             decision = transcodeDecisionService.decide(file, client.capabilities);
//             mode = 'transcode';
//         }
//
//         // Create/get session (internal tracking)
//         await streamingService.getOrCreateSession(file, quality, token);
//
//         // Build response with URLs
//         const baseUrl = `/api/streaming/${id}/${quality}`;
//
//         const response = {
//             mediaId: file.id,
//             quality,
//             mode,
//
//             // Main streaming URL - works for all modes
//             streamUrl: baseUrl,
//
//             // HLS-specific URLs (only relevant for transcoding)
//             playlistUrl: mode === 'transcode' ? `${baseUrl}/playlist.m3u8` : undefined,
//
//             // Decision details
//             decision: {
//                 video: {
//                     action: decision.video.action,
//                     reason: decision.video.reason,
//                     sourceCodec: decision.video.sourceCodec,
//                     targetCodec: decision.video.targetCodec,
//                     hwAccel: decision.video.hwAccel
//                 },
//                 audio: {
//                     action: decision.audio.action,
//                     reason: decision.audio.reason,
//                     sourceCodec: decision.audio.sourceCodec,
//                     targetCodec: decision.audio.targetCodec
//                 },
//                 subtitle: {
//                     action: decision.subtitle.action,
//                     reason: decision.subtitle.reason
//                 },
//                 container: {
//                     needsRemux: decision.container.needsRemux,
//                     reason: decision.container.reason,
//                     sourceContainer: decision.container.sourceContainer,
//                     targetContainer: decision.container.targetContainer
//                 }
//             },
//
//             // Why this mode was chosen
//             statistics: {
//                 directPlayReasons: decision.statistics.directPlayReasons,
//                 transcodeReasons: decision.statistics.transcodeReasons,
//                 remuxReasons: decision.statistics.remuxReasons
//             },
//
//             // Media metadata
//             metadata: {
//                 duration: file.metadata?.general.Duration || 0,
//                 resolution: file.metadata?.video[0]
//                     ? `${file.metadata.video[0].Width}x${file.metadata.video[0].Height}`
//                     : 'unknown',
//                 videoCodec: file.metadata?.video[0]?.Format || 'unknown',
//                 audioCodec: file.metadata?.audio[0]?.Format || 'unknown'
//             }
//         };
//
//         logger.INFO(
//             `Playback started: ${file.name} - ` +
//             `quality=${quality}, mode=${mode}, ` +
//             `video=${decision.video.action}, audio=${decision.audio.action}`
//         );
//
//         res.status(200).json(response);
//     } catch (error) {
//         logger.ERROR(`Error starting playback: ${error}`);
//         res.status(500).json({ error: 'Failed to start playback' });
//     }
// });
//
// /**
//  * Combined streaming endpoint for direct play, direct remux & transcode.
//  *  - Direct Play: Serves file as-is with Range support
//  *  - Direct Remux: FFmpeg pipe for container conversion
//  *  - Transcode: Returns HLS playlist
//  */
// router.get('/api/streaming/:id/:quality/', async (req: Request, res: Response) => {
//     const { id, quality } = req.params;
//     const token = req.headers['x-client-token'] as string || req.query.token as string || undefined;
//     const range = req.headers.range;
//
//     if (!token) {
//         return res.status(401).json({ error: 'No client token provided' });
//     }
//
//     // Get media file
//     const file = await findMediaFileById(id);
//     if (!file) {
//         return res.status(404).json({ error: 'Media file not found' });
//     }
//
//     if (!await pathExists(file.path)) {
//         return res.status(404).json({ error: 'Media file does not exist on disk' });
//     }
//
//     // Get client capabilities
//     const client = clientManager.getClient(token);
//     if (!client) {
//         return res.status(401).json({ error: 'Invalid client token' });
//     }
//
//     // Determine playback mode
//     let mode: 'direct_play' | 'direct_remux' | 'transcode';
//
//     if (quality === 'original') {
//         const decision = transcodeDecisionService.decide(file, client.capabilities);
//         mode = decision.mode as 'direct_play' | 'direct_remux' | 'transcode';
//     } else {
//         // Specific quality always requires transcoding
//         mode = 'transcode';
//     }
//
//     // Route to appropriate handler
//     switch (mode) {
//         case 'direct_play':
//             return await handleDirectPlay(req, res, file, range);
//         case 'direct_remux':
//             return await handleDirectRemux(req, res, file);
//         case 'transcode':
//             // For transcoding, redirect to playlist
//             return res.redirect(`/api/streaming/${id}/${quality}/playlist.m3u8`);
//         default:
//             return res.status(500).json({ error: 'Unknown playback mode' });
//     }
// });
//
// /**
//  * Get HLS playlist
//  * GET /api/media/:id/playlist.m3u8
//  */
// router.get('/api/streaming/:id/:quality/playlist.m3u8', async (req: Request, res: Response) => {
//     try {
//         const { id, quality } = req.params;
//         const token = req.headers['x-client-token'] as string || req.query.token as string || undefined;
//
//         const file = await findMediaFileById(id);
//         if (!file) {
//             return res.status(404).json({ error: 'Media file not found' });
//         }
//
//         if (!await pathExists(file.path)) {
//             return res.status(404).json({ error: 'Media file does not exist on disk' });
//         }
//
//         const { playlist, token: sessionToken } = await streamingService.generatePlaylist(file, quality, token);
//
//         res.setHeader('X-Stream-Token', sessionToken);
//         res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
//         res.setHeader('Cache-Control', 'no-cache');
//
//         res.send(playlist);
//     } catch (error) {
//         logger.ERROR(`Error creating stream: ${error}`);
//         res.status(500).json({ error: 'Failed to create stream' });
//     }
// });
//
//
// /**
//  * Get/generate HLS segment
//  * GET /api/media/:id/segment:index.ts
//  */
// router.get('/api/streaming/:id/:quality/segment:index.ts', async (req: Request, res: Response) => {
//     try {
//         const { id, quality, index } = req.params;
//         const segment = parseInt(index);
//         const token = req.headers['x-client-token'] as string
//             || req.query.token as string
//             || undefined;
//
//         if (isNaN(segment) || segment < 0) {
//             return res.status(400).json({ error: 'Invalid segment index' });
//         }
//
//         const file = await findMediaFileById(id);
//         if (!file) {
//             return res.status(404).json({ error: 'Media file not found' });
//         }
//
//         if (!await pathExists(file.path)) {
//             return res.status(404).json({ error: 'Media file does not exist on disk' });
//         }
//
//         const { path: segmentPath, token: sessionToken } = await streamingService.handleSegment(file, segment, quality, token);
//
//         res.setHeader('X-Client-Token', sessionToken);
//
//         if (segmentPath) {
//             res.setHeader('Content-Type', 'video/mp2t');
//             res.setHeader('Cache-Control', 'public, max-age=3600');
//             return res.sendFile(segmentPath);
//         }
//
//         // Segment not ready, ask client to retry
//         res.setHeader('Retry-After', '2');
//         res.status(503).json({
//             error: 'Segment not ready',
//             message: 'Transcoding in progress, please retry'
//         });
//     } catch (error) {
//         logger.ERROR(`Error serving segment: ${error}`);
//         res.status(500).json({ error: 'Failed to serve segment' });
//     }
// });
//
// /**
//  * Handle Direct Play - serve file as-is with Range support
//  */
// async function handleDirectPlay(req: Request, res: Response, file: any, range?: string): Promise<void> {
//     const stats = await stat(file.path);
//     const fileSize = stats.size;
//
//     // Set MIME type
//     const mimeType = getMimeType(file.extension);
//     res.setHeader('Content-Type', mimeType);
//     res.setHeader('Accept-Ranges', 'bytes');
//
//     // Handle Range request (for seeking)
//     if (range) {
//         const parts = range.replace(/bytes=/, '').split('-');
//         const start = parseInt(parts[0], 10);
//         const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
//         const chunkSize = (end - start) + 1;
//
//         // Validate range
//         if (start >= fileSize || end >= fileSize) {
//             res.status(416).setHeader('Content-Range', `bytes */${fileSize}`);
//             res.end();
//             return; // ← Kein Wert zurückgeben
//         }
//
//         logger.DEBUG(`Direct Play: Range ${start}-${end}/${fileSize} for ${file.name}`);
//
//         res.status(206); // Partial Content
//         res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
//         res.setHeader('Content-Length', chunkSize);
//
//         const stream = fs.createReadStream(file.path, { start, end });
//         stream.pipe(res);
//
//         stream.on('error', (error) => {
//             logger.ERROR(`Stream error: ${error}`);
//             if (!res.headersSent) {
//                 res.status(500).end();
//             }
//         });
//     } else {
//         // Full file
//         logger.DEBUG(`Direct Play: Full file for ${file.name}`);
//
//         res.setHeader('Content-Length', fileSize);
//
//         const stream = fs.createReadStream(file.path);
//         stream.pipe(res);
//
//         stream.on('error', (error) => {
//             logger.ERROR(`Stream error: ${error}`);
//             if (!res.headersSent) {
//                 res.status(500).end();
//             }
//         });
//     }
// }
//
// /**
//  * Handle Direct Remux - remux container on-the-fly using FFmpeg
//  * No video/audio transcoding, just container conversion (e.g., MKV → MP4)
//  */
// async function handleDirectRemux(req: Request, res: Response, file: any): Promise<void> {
//     logger.INFO(`Direct Remux: Starting remux for ${file.name}`);
//
//     // Set headers for streaming
//     res.setHeader('Content-Type', 'video/mp4');
//     res.setHeader('Accept-Ranges', 'bytes');
//
//     // FFmpeg command for remuxing (no transcoding)
//     const ffmpeg = spawn('ffmpeg', [
//         '-i', file.path,
//
//         // Copy streams without re-encoding
//         '-c:v', 'copy',
//         '-c:a', 'copy',
//         '-c:s', 'copy',
//
//         // Output format
//         '-f', 'mp4',
//         '-movflags', 'frag_keyframe+empty_moov+faststart',
//
//         // Pipe to stdout
//         'pipe:1'
//     ]);
//
//     // Pipe FFmpeg output to response
//     ffmpeg.stdout.pipe(res);
//
//     // Handle errors
//     ffmpeg.stderr.on('data', (data: any) => {
//         logger.DEBUG(`FFmpeg remux: ${data.toString()}`);
//     });
//
//     ffmpeg.on('error', (error: any) => {
//         logger.ERROR(`FFmpeg remux error: ${error}`);
//         if (!res.headersSent) {
//             res.status(500).end();
//         }
//     });
//
//     ffmpeg.on('close', (code: any) => {
//         if (code !== 0) {
//             logger.ERROR(`FFmpeg remux exited with code ${code}`);
//         } else {
//             logger.DEBUG(`Direct Remux completed for ${file.name}`);
//         }
//     });
//
//     // Handle client disconnect
//     req.on('close', () => {
//         logger.DEBUG('Client disconnected, killing FFmpeg remux');
//         ffmpeg.kill('SIGKILL');
//     });
// }
//
//
//
//
//
//
//
//
//
//
// router.get('/api/streaming/:id/kill', async (req: Request, res: Response) => {
//     try {
//         const { id } = req.params;
//         const token = req.headers['x-client-token'] as string
//             || req.query.token as string
//             || undefined;
//
//         // streamingService.get
//
//     } catch (error) {
//         logger.ERROR(`Error killing session: ${error}`);
//         res.status(500).json({ error: 'Failed to kill session' });
//     }
// });
//
// /**
//  * Direct Play endpoint with Range Request support
//  * GET /api/streaming/:id/direct
//  */
// router.get('/api/streaming/:id/direct', async (req: Request, res: Response) => {
//     try {
//         const { id } = req.params;
//         const range = req.headers.range;
//
//         const file = await findMediaFileById(id);
//         if (!file) {
//             return res.status(404).json({ error: 'Media file not found' });
//         }
//
//         if (!await pathExists(file.path)) {
//             return res.status(404).json({ error: 'Media file does not exist on disk' });
//         }
//
//         const stats = await stat(file.path);
//         const fileSize = stats.size;
//
//         // Set appropriate content type
//         const mimeType = getMimeType(file.extension);
//         res.setHeader('Content-Type', mimeType);
//         res.setHeader('Accept-Ranges', 'bytes');
//
//         // Handle range request (for seeking)
//         if (range) {
//             const parts = range.replace(/bytes=/, '').split('-');
//             const start = parseInt(parts[0], 10);
//             const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
//             const chunkSize = (end - start) + 1;
//
//             // Validate range
//             if (start >= fileSize || end >= fileSize) {
//                 res.status(416).setHeader('Content-Range', `bytes */${fileSize}`);
//                 return res.end();
//             }
//
//             logger.DEBUG(`Direct Play: Range request ${start}-${end}/${fileSize} for ${file.name}`);
//
//             res.status(206); // Partial Content
//             res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
//             res.setHeader('Content-Length', chunkSize);
//
//             // Create read stream for the range
//             const stream = fs.createReadStream(file.path, { start, end });
//             stream.pipe(res);
//
//             stream.on('error', (error) => {
//                 logger.ERROR(`Stream error: ${error}`);
//                 if (!res.headersSent) {
//                     res.status(500).end();
//                 }
//             });
//         } else {
//             // No range request -> Send entire file
//             logger.DEBUG(`Direct Play: Full file request for ${file.name}`);
//
//             res.setHeader('Content-Length', fileSize);
//
//             const stream = fs.createReadStream(file.path);
//             stream.pipe(res);
//
//             stream.on('error', (error) => {
//                 logger.ERROR(`Stream error: ${error}`);
//                 if (!res.headersSent) {
//                     res.status(500).end();
//                 }
//             });
//         }
//     } catch (error) {
//         logger.ERROR(`Error in direct play: ${error}`);
//         res.status(500).json({ error: 'Failed to stream media' });
//     }
// });
//
// /**
//  * Get MIME type based on file extension
//  */
// function getMimeType(extension: string): string {
//     const ext = extension.toLowerCase();
//
//     const mimeTypes: Record<string, string> = {
//         '.mp4': 'video/mp4',
//         '.m4v': 'video/mp4',
//         '.mkv': 'video/x-matroska',
//         '.webm': 'video/webm',
//         '.avi': 'video/x-msvideo',
//         '.mov': 'video/quicktime',
//         '.wmv': 'video/x-ms-wmv',
//         '.flv': 'video/x-flv',
//         '.mpg': 'video/mpeg',
//         '.mpeg': 'video/mpeg'
//     };
//
//     return mimeTypes[ext] || 'video/mp4';
// }

export default router;