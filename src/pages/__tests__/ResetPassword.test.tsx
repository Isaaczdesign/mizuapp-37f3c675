import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "@/lib/router-compat";
import ResetPassword from "../ResetPassword";

// ---- Mocks ----
const exchangeCodeForSession = vi.fn<(code: any) => any>();
const verifyOtp = vi.fn<(arg: any) => any>();
const setSession = vi.fn<(arg: any) => any>();
const getSession = vi.fn<() => any>();
const updateUser = vi.fn<(arg: any) => any>();
const onAuthStateChange = vi.fn<(cb: any) => any>(() => ({
  data: { subscription: { unsubscribe: vi.fn() } },
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      exchangeCodeForSession: (arg: any) => exchangeCodeForSession(arg),
      verifyOtp: (arg: any) => verifyOtp(arg),
      setSession: (arg: any) => setSession(arg),
      getSession: () => getSession(),
      updateUser: (arg: any) => updateUser(arg),
      onAuthStateChange: (cb: any) => onAuthStateChange(cb),
    },
  },
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const renderAt = (path: string) => {
  window.history.pushState({}, "", path);
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/auth" element={<div>Auth Page</div>} />
        <Route path="/reset-password/success" element={<div>Success Page</div>} />
      </Routes>
    </MemoryRouter>
  );
};

describe("ResetPassword E2E flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSession.mockResolvedValue({ data: { session: null } });
  });

  it("shows fallback message when URL has no token", async () => {
    renderAt("/reset-password");
    expect(
      await screen.findByText(/Abra o link enviado ao seu e-mail/i)
    ).toBeInTheDocument();
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
    expect(verifyOtp).not.toHaveBeenCalled();
  });

  it("exchanges ?code= param and shows the new-password form", async () => {
    exchangeCodeForSession.mockResolvedValue({ data: {}, error: null });
    renderAt("/reset-password?code=valid-code-123");

    await waitFor(() =>
      expect(exchangeCodeForSession).toHaveBeenCalledWith("valid-code-123")
    );
    expect(await screen.findByLabelText(/^Nova senha$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Confirmar nova senha/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Redefinir senha/i })
    ).toBeInTheDocument();
  });

  it("verifies ?token_hash=&type=recovery and shows the form", async () => {
    verifyOtp.mockResolvedValue({ data: {}, error: null });
    renderAt("/reset-password?token_hash=abc123&type=recovery");

    await waitFor(() =>
      expect(verifyOtp).toHaveBeenCalledWith({
        token_hash: "abc123",
        type: "recovery",
      })
    );
    expect(await screen.findByLabelText(/^Nova senha$/i)).toBeInTheDocument();
  });

  it("shows the form when a session already exists (legacy hash flow)", async () => {
    getSession.mockResolvedValue({
      data: { session: { access_token: "t", user: { id: "u" } } },
    });
    renderAt("/reset-password");

    expect(await screen.findByLabelText(/^Nova senha$/i)).toBeInTheDocument();
  });

  it("redirects to /auth when the recovery code is invalid", async () => {
    exchangeCodeForSession.mockResolvedValue({
      data: {},
      error: { message: "invalid" },
    });
    renderAt("/reset-password?code=bad-code");

    expect(
      await screen.findByText("Auth Page", {}, { timeout: 3000 })
    ).toBeInTheDocument();
    expect(screen.queryByLabelText(/^Nova senha$/i)).not.toBeInTheDocument();
  });
});
