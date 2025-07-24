
import { z } from 'zod';
import { AbsoluteFill, Video, useCurrentFrame, useVideoConfig } from 'remotion';
import { Word } from './Word';
import { transcriptionSchema } from './schemas';
import React from 'react';
export const subtitledClipSchema = z.object({
	videoUrl: z.string().url(),
	transcription: transcriptionSchema,
});

export const SubtitledClip: React.FC<z.infer<typeof subtitledClipSchema>> = ({
	videoUrl,
	transcription,
}) => {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();
	const currentTime = frame / fps;

	const allWords = transcription.segments.flatMap((segment) => segment.words);
	type WordType = (typeof allWords)[number];
	// Split words into lines of max 3 words
	const lines: { words: WordType[] }[] = [];
	let currentLine: { words: WordType[] } = { words: [] };
	for (const word of allWords) {
		currentLine.words.push(word);
		if (currentLine.words.length === 3) {
			lines.push(currentLine);
			currentLine = { words: []};
		}
	}
	if (currentLine.words.length > 0) {
		lines.push(currentLine);
	}

	return (
		<AbsoluteFill style={{ backgroundColor: 'black' }}>
			<AbsoluteFill>
				<Video src={videoUrl} />
			</AbsoluteFill>
			<AbsoluteFill style={{
				justifyContent: 'center',
				alignItems: 'center',
                padding: '0 5%', // Add padding to avoid text touching edges
			}}>
				<div style={{
					display: 'flex',
					flexDirection: 'column',
					justifyContent: 'center',
					alignItems: 'center',
					height: '100%',
                    width: '100%',
				}}>
					<div style={{
						display: 'flex',
						flexDirection: 'column',
						justifyContent: 'center',
						alignItems: 'center',
						textAlign: 'center',
						position: 'absolute',
						bottom: '15%', // Position subtitles lower on the screen
					}}>
						{lines.map((line, i) => (
							<div key={i} style={{ display: 'flex', flexDirection: 'row' }}>
								{line.words.map((word, j) => (
									<Word
										key={j}
										frame={frame}
										word={word.word}
										start={word.start}
										end={word.end}
									/>
								))}
							</div>
						))}
					</div>
				</div>
			</AbsoluteFill>
		</AbsoluteFill>
	);
};
