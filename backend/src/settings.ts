import { VideoCodec } from "./types/media";

export type HardwareAcceleration = 'none' | 'intel_quick_sync' | 'nvidia_nvenc';
export const renderDevice = '/dev/dri/renderD128';
export const supportedCodecsForHardwareAcceleration: VideoCodec[] = ['h264', 'hevc', 'hevc_10bit', 'vp9', 'vp9_10bit', 'av1'];

export const supportEncodingInHEVC: boolean = true;
export const supportEncodingInAV1: boolean = true;

/**
 * If enabled, media is remuxed to fragmented MP4 (fMP4) even when
 * direct file streaming with byte ranges would be possible.
 * This improves seek performance and playback stability.
 */
export const preferFragmentedMp4 = true;

/**
 * Vollständig Treiber-basiertes Tone-Mapping für Intel-Chips. Funktioniert derzeit nur auf
 * bestimmter Hardware und nur mit HDR10-Videos. Dieses Tone-Mapping hat Präferenz vor anderen, OpenCL-basierten
 * Tone-Mapping-Implementierungen.
 */
export const enableVPPToneMapping: boolean = true;
export const vppToneMappingBrightnessBoost: number = 16; // Wende Helligkeitsverstärkung für VPP-Tone-Mapping an. Der empfohlene Wert ist 16.
export const vppContrastBoost: number = 1; // Kontrast für VPP-Tone-Mapping verstärken. Der empfohlene Wert ist 1.

/**
 * Tone-Mapping kann den Dynamikumfang eines Videos von HDR nach SDR wandeln und dabei die für die Darstellung
 * der Originalszene sehr wichtigen Bilddetails und Farben beibehalten. Dies funktioniert derzeit nur
 * bei 10bit HDR10, HLG und DoVi-Videos. Erfordert die entsprechende GPGPU-Laufzeitumgebung.
 */
export const enableToneMapping: boolean = true;
export type ToneMappingAlgorithm = 'none' | 'clip' | 'linear' | 'gamma' | 'reinhard' | 'hable' | 'mobius' | 'bt.2390';
export const toneMappingAlgorithm: ToneMappingAlgorithm = 'hable';
export type ToneMappingMode = 'auto' | 'max' | 'rgb' | 'lum' | 'itp';
export const toneMappingMode: ToneMappingMode = 'auto'; // Tone-Mapping-Modus auswählen. Falls es zu Überbelichtungen kommt, versuche in den RGB-Modus zu wechseln.
export const toneMappingDesaturation: number = 0; // Wendet die Entsättigung für Lichter an, die diesen Helligkeitsgrad überschreiten. Der empfohlene Wert ist 0 (deaktiviert).
export const toneMappingPeak: number = 100; // Überschreibt den Maximalwert des Input Signals der eingebetteten Metadaten mit diesem Wert. Der Standardwert ist 100 (1000nit).
export const toneMappingParameter: string = ''; // Feinabstimmung des Tone-Mapping-Algorithmus. Im Allgemeinen leer lassen.
export const toneMappingThreads: number = -1; // Legt die maximale Anzahl von Transkodierungs-Threads fest. Das Reduzieren der Thread-Anzahl verringert die CPU-Auslastung, verhindert aber möglicherweise eine ausreichend schnelle Transkodierung für eine störungsfreie Wiedergabe.

export const enableFallbackFonts: boolean = false;
export const fallbackFontsPath: string = '';

export const enableAudioEncodingWithVBR: boolean = false; // Eine variable Bitrate bietet bessere Qualität im Vergleich zu einer konstanten, kann jedoch in manchen Fällen zu Problemen beim Buffering und der Kompatibilität führen.
export const audioBoostForDownmix: number = 2; // Lautstärke beim Heruntermischen erhöhen. Setze den Wert auf 1, um die Originallautstärke zu erhalten.
export type AudioDownmixAlgorithm = 'none' | 'dave750' | 'nightmodel_dialogue' | 'rfc7845' | 'ac_4'; // Algorithmus um Mehrkanal-Audio zu Stereo-Audio herunterzumischen.
export const audioDownmixAlgorithm: AudioDownmixAlgorithm = 'none';
export const maxSizeMuxingQueue: number = 2048; // Maximale Anzahl von Paketen, die gepuffert werden können, während auf die Initialisierung aller Streams gewartet wird. Versuche diese zu erhöhen, wenn in den FFmpeg-Protokollen der Fehler "Zu viele Pakete für den Ausgabestrom gepuffert" auftaucht. Der empfohlene Wert ist 2048.

export type VideoEncodingPreset = 'auto' | 'veryslow' | 'slower' | 'slow' | 'medium' | 'fast' | 'faster' | 'veryfast' | 'superfast' | 'ultrafast' // Wähle einen schnelleren Wert um die Performance zu verbessern oder einen langsameren Wert um die Qualität zu verbessern.
export const videoEncodingPreset: VideoEncodingPreset = 'auto';
export const crfForHEVCEncoding: number = 22;
export const crfForAVCEncoding: number = 20; // Der Constant Rate Factor (CRF) bezeichnet die Einstellung für die Standardqualität des x264 und x265 Software-Encoders. Setze einen Wert zwischen 0 und 51. Ein niedriger Wert resultiert in besserer Qualität (auf Kosten einer größeren Datei). Gängige Werte sind 18-28. Der Standard für x264 ist 23 und 28 für x265, diese sollten als Referenzen verwendet werden. Hardware-Encoder verwenden diese Einstellung nicht.

export type DeinterlaceAlgorithm = 'yadif' | 'bwdif';
export const deinterlaceMethod: DeinterlaceAlgorithm = 'yadif'; // Wähle die Deinterlacing-Methode zum Transkodieren von Inhalten im Zeilensprungverfahren (Interlace). Sofern bei unterstützten Geräten Deinterlacing durch Hardwarebeschleunigung aktiviert ist, wird der Hardware-Deinterlacer anstelle dieser Einstellung verwendet.
export const deinterlaceFrameDoubling: boolean = false; // Diese Einstellung verwendet die Halbbildrate beim Deinterlacing, oft auch als Bob-Deinterlacing bezeichnet. Dabei wird die Bildrate des Videos verdoppelt, um eine vollständige Bewegung wie beim Betrachten eines Interlaced-Video auf einem Fernseher zu erzielen.

export const enableParallelSubtitleExtraction: boolean = true; // Eingebettete Untertitel können aus Videos extrahiert und als Klartext an Clients gesendet werden, um eine Videotranskodierung zu vermeiden. Auf manchen Systemen kann dieser Vorgang eine lange Zeit in Anspruch nehmen und deswegen währenddessen die Videowiedergabe stoppen. Deaktiviere diese Option, um eingebettete Untertitel während des Videotranskodierens einbrennen zu lassen, wenn sie nicht nativ vom Client unterstützt werden.
export const reduceTranscodingSpeed: boolean = false; // Wenn eine Transkodierung oder ein Remux weit genug über die aktuelle Abspielposition fortgeschritten ist, pausiere sie, sodass weniger Ressourcen verbraucht werden. Dies ist am nützlichsten, wenn wenig übersprungen wird. Bei Wiedergabeproblemen sollte diese Option deaktiviert werden.
export const transcodeReduceTime: number = 180; // Zeit in Sekunden, nach der die Transkodierung gedrosselt wird. Muss groß genug sein, damit der Client einen gesunden Puffer aufrechterhalten kann. Funktioniert nur wenn "Transkodierung drosseln" aktiviert ist.

export const deleteSegmentAfterTime: boolean = false; // Alte Segmente löschen, nachdem sie vom Client heruntergeladen wurden. Damit muss nicht die gesamte transkodierte Datei auf der Festplatte zwischengespeichert werden. Deaktiviere diese Option, wenn bei der Wiedergabe Probleme auftreten.
export const segmentDeleteTime: number = 720; // Zeit in Sekunden, für die Segmente nach dem Download im Client behalten werden sollen, bevor sie überschrieben werden. Funktioniert nur wenn "Segmente löschen" aktiviert ist.

