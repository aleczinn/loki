import mediaInfoFactory from 'mediainfo.js'
import fs from 'fs'
import path from 'path'
import ffmpeg from 'fluent-ffmpeg'
import { MediaMetadata } from "../types/media-metadata";
import { GeneralTrack } from "../types/general-track";
import { VideoTrack } from "../types/video-track";
import { SubtitleTrack } from "../types/subtitle-track";
import { BaseTrack } from "../types/base-track";
import { AudioTrack } from "../types/audio-track";

export async function getMetaDataMediaInfo(path: string) {
    const factory = await mediaInfoFactory({
        chunkSize: 1024 * 1024
    })

    try {
        const stats = await fs.promises.stat(path)
        const fileSize = stats.size

        return await factory.analyzeData(
            () => fileSize,

            (chunkSize, offset) => {
                const buffer = Buffer.alloc(chunkSize)
                const fd = fs.openSync(path, 'r')

                try {
                    const bytesRead = fs.readSync(fd, buffer, 0, chunkSize, offset)
                    return new Uint8Array(buffer.buffer, buffer.byteOffset, bytesRead)
                } finally {
                    fs.closeSync(fd)
                }
            }
        )
    } finally {
        factory.close()
    }
}

export async function getMetaDataFFprobe(path: string): Promise<string> {
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(path, (error, metadata) => {
            if (error) {
                reject(`Error for analyzing ffprobe metadata for file: ${path}`)
                return
            }

            const data = JSON.stringify(metadata, null, 2)
            resolve(data)
        })
    })
}

export async function getCombinedMetadata(path: string): Promise<MediaMetadata | null> {
    const [mediaInfoData, ffprobeDataString] = await Promise.all([
        getMetaDataMediaInfo(path),
        getMetaDataFFprobe(path)
    ])

    const ffprobeData = JSON.parse(ffprobeDataString)

    const ffprobeSubtitleMap = new Map()
    ffprobeData.streams?.forEach((stream: any) => {
        if (stream.codec_type === 'subtitle') {
            ffprobeSubtitleMap.set(stream.index, stream)
        }
    })

    if (mediaInfoData.media?.track) {
        let general: GeneralTrack = {} as GeneralTrack
        let video: VideoTrack[] = []
        let audio: AudioTrack[] = []
        let subtitle: SubtitleTrack[] = []

        mediaInfoData.media.track.forEach((track: BaseTrack) => {
            switch (track['@type']) {
                case 'General':
                    general = track as GeneralTrack
                    break
                case 'Video':
                    video.push(track as VideoTrack)
                    break
                case 'Audio':
                    audio.push(track as AudioTrack)
                    break
                case 'Text':
                    const subtitleTrack = track as SubtitleTrack

                    const streamOrder = parseInt(subtitleTrack.StreamOrder || '-1')
                    const ffprobeStream = ffprobeSubtitleMap.get(streamOrder)

                    if (streamOrder !== -1 && ffprobeStream?.disposition) {
                        const disposition = ffprobeStream.disposition

                        if (subtitleTrack.Forced != (disposition.forced == 1 ? 'Yes' : 'No')) {
                            console.error(`Warning! metadata field 'forced' does not match in mediainfo and ffprobe!`)
                            return null
                        }

                        if (subtitleTrack.Default != (disposition.default == 1 ? 'Yes' : 'No')) {
                            console.error(`Warning! metadata field 'default' does not match in mediainfo and ffprobe!`)
                            return null
                        }

                        Object.assign(subtitleTrack, {
                            Default: disposition.default === 1 ? 'Yes' : 'No',
                            Forced: disposition.forced === 1 ? 'Yes' : 'No',

                            HearingImpaired: disposition.hearing_impaired === 1 ? 'Yes' : 'No',
                            VisualImpaired: disposition.visual_impaired === 1 ? 'Yes' : 'No',
                            Original: disposition.original === 1 ? 'Yes' : 'No',
                            Dub: disposition.dub === 1 ? 'Yes' : 'No',
                            Commentary: disposition.comment === 1 ? 'Yes' : 'No',
                            Captions: disposition.captions === 1 ? 'Yes' : 'No',
                            Descriptions: disposition.descriptions === 1 ? 'Yes' : 'No',
                            CleanEffects: disposition.clean_effects === 1 ? 'Yes' : 'No',
                            Lyrics: disposition.lyrics === 1 ? 'Yes' : 'No',
                            Karaoke: disposition.karaoke === 1 ? 'Yes' : 'No'
                        })
                    }

                    subtitle.push(subtitleTrack)
                    break
            }
        })
        return { general, video, audio, subtitle }
    }
    return null
}
