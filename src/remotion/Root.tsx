"use client";

import { Composition, getInputProps } from 'remotion';
import React from 'react';
import { SubtitledClip, subtitledClipSchema } from './SubtitledClip';
import './style.css';
import { z } from 'zod';

// Each composition needs a unique ID
const COMP_ID = 'SubtitledClip';

// You can customize the dimensions and FPS for the video here.
export const RemotionRoot: React.FC = () => {
	const { durationInFrames } = getInputProps() as { durationInFrames: number };
	
	return (
		<Composition
			id={COMP_ID}
			component={SubtitledClip}
			durationInFrames={durationInFrames}
			fps={30}
			width={1080}
			height={1920}
			// You can pass arbitrary props to your component using the schema
			schema={subtitledClipSchema}
			defaultProps={{
				// Default props are used for the Remotion Studio
				// and can be overridden when rendering programmatically.
				videoUrl: 'https://storage.googleapis.com/538838696347-media/video-cortado.mp4',
				transcription: {
					titulo: 'Default Title',
					segments: [
						{
							id: 0,
							seek: 0,
							start: 0,
							end: 2,
							text: 'Hello World',
							tokens: [],
							temperature: 0,
							avg_logprob: 0,
							compression_ratio: 0,
							no_speech_prob: 0,
							words: [
								{ word: 'Hello', start: 0, end: 1, probability: 1 },
								{ word: 'World', start: 1, end: 2, probability: 1 },
							],
						},
					],
				},
			}}
		/>
	);
};
