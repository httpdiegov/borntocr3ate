"use client";

import { Composition, getInputProps } from 'remotion';
import * as React from 'react';
import { SubtitledClip, subtitledClipSchema } from './SubtitledClip';
import './style.css';

// Each composition needs a unique ID
const COMP_ID = 'SubtitledClip';

// You can customize the dimensions and FPS for the video here.
export const RemotionRoot: React.FC = () => {
	// This will now get the duration passed from the `addSubtitles` flow
	const { durationInFrames } = getInputProps() as { durationInFrames: number };
	
	return (
		<Composition
			id={COMP_ID}
			component={SubtitledClip}
			durationInFrames={durationInFrames > 0 ? durationInFrames : 1} // Ensure duration is at least 1
			fps={30}
			width={1080}
			height={1920}
			// The schema now expects the data directly
			schema={subtitledClipSchema}
			defaultProps={{
				// These are just placeholder values for the Remotion Studio
				videoUrl: 'https://storage.googleapis.com/538838696347-media/video-cortado.mp4',
				transcription: {
					titulo: 'Placeholder',
					segments: []
				}
			}}
		/>
	);
};
