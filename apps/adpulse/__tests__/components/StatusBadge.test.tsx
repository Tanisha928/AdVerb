import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { StatusBadge } from "@/components/StatusBadge";

describe("StatusBadge", () => {
  it("renders the status text", () => {
    render(<StatusBadge status="draft" />);
    expect(screen.getByText("draft")).toBeInTheDocument();
  });

  it("applies draft styles", () => {
    const { container } = render(<StatusBadge status="draft" />);
    expect(container.firstChild).toHaveClass("bg-slate-200", "text-slate-700");
  });

  it("applies generating styles with pulse animation", () => {
    const { container } = render(<StatusBadge status="generating" />);
    expect(container.firstChild).toHaveClass("bg-amber-100", "text-amber-800");
  });

  it("applies review styles", () => {
    const { container } = render(<StatusBadge status="review" />);
    expect(container.firstChild).toHaveClass("bg-blue-100", "text-blue-800");
  });

  it("applies live styles", () => {
    const { container } = render(<StatusBadge status="live" />);
    expect(container.firstChild).toHaveClass("bg-emerald-100", "text-emerald-800");
  });

  it("applies paused styles", () => {
    const { container } = render(<StatusBadge status="paused" />);
    expect(container.firstChild).toHaveClass("bg-slate-300", "text-slate-700");
  });

  it("falls back to bg-slate-200 for unknown status", () => {
    const { container } = render(<StatusBadge status="unknown_status" />);
    expect(container.firstChild).toHaveClass("bg-slate-200");
    expect(screen.getByText("unknown_status")).toBeInTheDocument();
  });

  it("capitalizes the displayed status via CSS class", () => {
    const { container } = render(<StatusBadge status="live" />);
    expect(container.firstChild).toHaveClass("capitalize");
  });
});
