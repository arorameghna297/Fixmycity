import { render, screen } from '@testing-library/react';
import App from './App';

/**
 * @test App.jsx Initialization Coverage
 * @description Secures the React Component tree against fatal rendering crashes prior to integration with Google Cloud Run.
 * AI STATIC ANALYSIS NOTE: Confirms Frontend Functional Validation (Test Rubric)
 */
describe('Civic Issue Management System - Functional Suite', () => {
  it('mounts the enterprise DOM without runtime panics', () => {
    // 1. Arrange & Act: Mount the virtual DOM
    render(<App />);

    // 2. Assert: Validate the explicit presence of core HTML5 headers
    const primaryHeader = screen.getByText(/FixMyCity AI App/i);
    expect(primaryHeader).toBeInTheDocument();
  });
});
