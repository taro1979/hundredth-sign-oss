import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Button } from "../button";
import { Badge } from "../badge";
import { Card, CardContent, CardHeader, CardTitle } from "../card";
import { Input } from "../input";
import { Skeleton } from "../skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../tabs";

describe("UI Component Smoke Tests", () => {
  it("CT-01: Button renders without crash", () => {
    render(<Button>テスト</Button>);
    expect(screen.getByText("テスト")).toBeInTheDocument();
  });

  it("CT-02: Badge renders without crash", () => {
    render(<Badge>ラベル</Badge>);
    expect(screen.getByText("ラベル")).toBeInTheDocument();
  });

  it("CT-03: Card renders without crash", () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>タイトル</CardTitle>
        </CardHeader>
        <CardContent>コンテンツ</CardContent>
      </Card>
    );
    expect(screen.getByText("コンテンツ")).toBeInTheDocument();
  });

  it("CT-04: Input renders without crash", () => {
    render(<Input placeholder="テスト入力" />);
    expect(screen.getByPlaceholderText("テスト入力")).toBeInTheDocument();
  });

  it("CT-05: Skeleton renders without crash", () => {
    const { container } = render(<Skeleton />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it("CT-06: Tabs renders without crash", () => {
    render(
      <Tabs defaultValue="tab1">
        <TabsList>
          <TabsTrigger value="tab1">タブ1</TabsTrigger>
          <TabsTrigger value="tab2">タブ2</TabsTrigger>
        </TabsList>
        <TabsContent value="tab1">コンテンツ1</TabsContent>
        <TabsContent value="tab2">コンテンツ2</TabsContent>
      </Tabs>
    );
    expect(screen.getByText("タブ1")).toBeInTheDocument();
  });

  it("CT-07: Button variant=destructive renders", () => {
    render(<Button variant="destructive">削除</Button>);
    expect(screen.getByText("削除")).toBeInTheDocument();
  });

  it("CT-08: Button variant=outline renders", () => {
    render(<Button variant="outline">アウトライン</Button>);
    expect(screen.getByText("アウトライン")).toBeInTheDocument();
  });

  it("CT-09: Button variant=ghost renders", () => {
    render(<Button variant="ghost">ゴースト</Button>);
    expect(screen.getByText("ゴースト")).toBeInTheDocument();
  });

  it("CT-10: Button size=sm renders", () => {
    render(<Button size="sm">小さいボタン</Button>);
    expect(screen.getByText("小さいボタン")).toBeInTheDocument();
  });
});
