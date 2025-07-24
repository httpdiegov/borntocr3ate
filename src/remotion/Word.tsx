"use client";

import * as React from 'react';
import { interpolate, useCurrentFrame } from 'remotion';

const FONT_FAMILY = 'Arial, Helvetica, sans-serif';

type WordProps = {
    frame: number;
    word: string;
    start: number; // in seconds
    end: number;   // in seconds
};

export const Word: React.FC<WordProps> = ({ frame, word, start, end }) => {
    const FADE_DURATION_IN_FRAMES = 5;

    const opacity = interpolate(
        frame,
        [start * 30, start * 30 + FADE_DURATION_IN_FRAMES],
        [0, 1],
        {
            extrapolateRight: 'clamp',
        }
    );

    const isActive = frame >= start * 30 && frame <= end * 30;

    const scale = isActive
        ? interpolate(frame, [start * 30, start * 30 + 3], [1, 1.1], { extrapolateRight: 'clamp' })
        : 1;

    const color = isActive ? '#FFFF00' : '#FFFFFF'; // Yellow for active word, white for inactive
    const textShadow = isActive 
        ? '0 0 10px #000000, 0 0 20px #000000, 0 0 30px #000000'
        : '0 0 5px #000000, 0 0 10px #000000';

    return (
        <span
            style={{
                display: 'inline-block',
                fontFamily: FONT_FAMILY,
                fontWeight: 'bold',
                fontSize: '90px', // Larger font size
                color: color,
                opacity,
                transform: `scale(${scale})`,
                transition: 'transform 0.1s, color 0.1s',
                padding: '0 10px',
                textShadow: textShadow,
                lineHeight: '1.2', // Adjust line height
            }}
        >
            {word}
        </span>
    );
};
