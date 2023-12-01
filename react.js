import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';

// EXAMPLE TESTING
const sum = require('./sum');

test('adds 1 + 2 to equal 3', () => {
  expect(sum(1, 2)).toBe(3);
});

describe('App Component', () => {
  test('renders the header text', () => {
    render(<App />);
    const headerElement = screen.getByText(/Front End Proof of Concept/i);
    expect(headerElement).toBeInTheDocument();
  });

  test('renders the body text', () => {
    render(<App />);
    const bodyElement = screen.getByText(/We're putting a video player here/i);
    expect(bodyElement).toBeInTheDocument();
  });
});




     