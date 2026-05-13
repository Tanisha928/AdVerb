import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { AngleBadge } from "@/components/AngleBadge";

describe("AngleBadge", () => {
  it("renders social_proof angle with purple styles", () => {
    const { container } = render(<AngleBadge angle="social_proof" />);
    expect(container.firstChild).toHaveClass("bg-purple-100", "text-purple-800");
    expect(screen.getByText("social proof")).toBeInTheDocument();
  });

  it("renders urgency angle with red styles", () => {
    const { container } = render(<AngleBadge angle="urgency" />);
    expect(container.firstChild).toHaveClass("bg-red-100", "text-red-800");
    expect(screen.getByText("urgency")).toBeInTheDocument();
  });

  it("renders benefit angle with teal styles", () => {
    const { container } = render(<AngleBadge angle="benefit" />);
    expect(container.firstChild).toHaveClass("bg-teal-100", "text-teal-800");
    expect(screen.getByText("benefit")).toBeInTheDocument();
  });

  it("renders curiosity angle with amber styles", () => {
    const { container } = render(<AngleBadge angle="curiosity" />);
    expect(container.firstChild).toHaveClass("bg-amber-100", "text-amber-900");
    expect(screen.getByText("curiosity")).toBeInTheDocument();
  });

  it("replaces underscore with space in angle text", () => {
    render(<AngleBadge angle="social_proof" />);
    expect(screen.getByText("social proof")).toBeInTheDocument();
  });

  it("falls back to 'variant' when angle is null", () => {
    render(<AngleBadge angle={null} />);
    expect(screen.getByText("variant")).toBeInTheDocument();
  });

  it("falls back to 'variant' when angle is undefined", () => {
    render(<AngleBadge />);
    expect(screen.getByText("variant")).toBeInTheDocument();
  });

  it("shows unknown angle with fallback slate styles", () => {
    const { container } = render(<AngleBadge angle="unknown_angle" />);
    expect(container.firstChild).toHaveClass("bg-slate-200", "text-slate-700");
  });

  it("is uppercase via CSS class", () => {
    const { container } = render(<AngleBadge angle="benefit" />);
    expect(container.firstChild).toHaveClass("uppercase");
  });
});
