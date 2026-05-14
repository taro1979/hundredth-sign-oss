import React from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { UserManagement } from "./OrganizationSettings";

afterEach(() => cleanup());

describe("OrganizationSettings user management", () => {
  it("labels mustChangePassword staff as waiting for initial password change", () => {
    render(
      <UserManagement
        staff={[
          {
            id: 2,
            email: "member@example.com",
            name: "Member",
            staffRole: "member",
            isActive: true,
            mustChangePassword: true,
            lastSignedIn: null,
            createdAt: new Date("2026-05-14T00:00:00Z"),
          },
        ]}
        currentUserId={1}
        isAdmin
        isLoading={false}
      />,
    );

    expect(screen.getByText("初回PW変更待ち")).toHaveAttribute(
      "title",
      "仮パスワードで作成され、本人のパスワード変更が未完了です",
    );
  });
});
