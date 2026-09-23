#!/usr/bin/env python3
"""Generate NovaPay project documentation PDF (stdlib only)."""

from __future__ import annotations

import zlib
from pathlib import Path


PAGE_W, PAGE_H = 595.28, 841.89  # A4
MARGIN_L, MARGIN_R = 48.0, 48.0
MARGIN_T, MARGIN_B = 52.0, 52.0
CONTENT_W = PAGE_W - MARGIN_L - MARGIN_R


def escape_pdf(text: str) -> str:
    return (
        text.replace("\\", "\\\\")
        .replace("(", "\\(")
        .replace(")", "\\)")
        .replace("\r", "")
    )


def wrap_text(text: str, font_size: float, max_width: float) -> list[str]:
    """Approximate wrapping using Helvetica average char width ~0.5em."""
    if not text:
        return [""]
    avg = font_size * 0.50
    max_chars = max(1, int(max_width / avg))
    words = text.split()
    lines: list[str] = []
    current = ""
    for word in words:
        trial = f"{current} {word}".strip()
        if len(trial) <= max_chars:
            current = trial
        else:
            if current:
                lines.append(current)
            # Hard-break long tokens
            while len(word) > max_chars:
                lines.append(word[:max_chars])
                word = word[max_chars:]
            current = word
    if current:
        lines.append(current)
    return lines or [""]


class PdfDoc:
    def __init__(self) -> None:
        self.pages: list[list[tuple]] = []
        self.ops: list[tuple] = []
        self.y = PAGE_H - MARGIN_T
        self.page_num = 0
        self.total_placeholder = True

    def new_page(self) -> None:
        if self.ops:
            self.pages.append(self.ops)
        self.ops = []
        self.page_num += 1
        self.y = PAGE_H - MARGIN_T

    def ensure_space(self, needed: float) -> None:
        if self.y - needed < MARGIN_B:
            self.new_page()

    def draw_text(
        self,
        text: str,
        *,
        size: float = 10,
        bold: bool = False,
        color: tuple[float, float, float] = (0.06, 0.09, 0.16),
        indent: float = 0,
        leading: float | None = None,
    ) -> None:
        leading = leading or size * 1.35
        font = "F2" if bold else "F1"
        x = MARGIN_L + indent
        max_w = CONTENT_W - indent
        for line in wrap_text(text, size, max_w):
            self.ensure_space(leading)
            self.ops.append(("text", x, self.y, size, font, color, line))
            self.y -= leading

    def spacer(self, h: float = 8) -> None:
        self.y -= h

    def rule(self, color: tuple[float, float, float] = (0.06, 0.46, 0.43)) -> None:
        self.ensure_space(10)
        y = self.y + 2
        self.ops.append(("line", MARGIN_L, y, MARGIN_L + CONTENT_W, y, color, 1.5))
        self.y -= 8

    def bullet(self, text: str, size: float = 10) -> None:
        leading = size * 1.35
        self.ensure_space(leading)
        x = MARGIN_L
        max_w = CONTENT_W - 14
        lines = wrap_text(text, size, max_w)
        self.ops.append(("text", x, self.y, size, "F1", (0.06, 0.46, 0.43), "-"))
        self.ops.append(("text", x + 12, self.y, size, "F1", (0.06, 0.09, 0.16), lines[0]))
        self.y -= leading
        for line in lines[1:]:
            self.ensure_space(leading)
            self.ops.append(("text", x + 12, self.y, size, "F1", (0.06, 0.09, 0.16), line))
            self.y -= leading

    def numbered(self, n: int, text: str, size: float = 10) -> None:
        leading = size * 1.35
        self.ensure_space(leading)
        prefix = f"{n}."
        x = MARGIN_L
        lines = wrap_text(text, size, CONTENT_W - 18)
        self.ops.append(("text", x, self.y, size, "F2", (0.06, 0.46, 0.43), prefix))
        self.ops.append(("text", x + 18, self.y, size, "F1", (0.06, 0.09, 0.16), lines[0]))
        self.y -= leading
        for line in lines[1:]:
            self.ensure_space(leading)
            self.ops.append(("text", x + 18, self.y, size, "F1", (0.06, 0.09, 0.16), line))
            self.y -= leading

    def heading1(self, text: str) -> None:
        if self.ops and self.y < PAGE_H - MARGIN_T - 20:
            self.new_page()
        self.draw_text(text, size=16, bold=True, color=(0.06, 0.09, 0.16), leading=20)
        self.rule()
        self.spacer(4)

    def heading2(self, text: str) -> None:
        self.spacer(6)
        self.ensure_space(28)
        self.draw_text(text, size=12, bold=True, color=(0.06, 0.46, 0.43), leading=16)
        self.spacer(2)

    def heading3(self, text: str) -> None:
        self.spacer(4)
        self.draw_text(text, size=10.5, bold=True, leading=14)

    def para(self, text: str, size: float = 10) -> None:
        self.draw_text(text, size=size)
        self.spacer(4)

    def code_block(self, text: str) -> None:
        lines = text.splitlines() or [""]
        line_h = 10
        pad = 8
        box_h = pad * 2 + line_h * len(lines)
        self.ensure_space(box_h + 6)
        y_top = self.y
        y_bot = self.y - box_h
        self.ops.append(("rect", MARGIN_L, y_bot, CONTENT_W, box_h, (0.95, 0.96, 0.98), (0.80, 0.84, 0.88)))
        y = y_top - pad - 7
        for line in lines:
            self.ops.append(("text", MARGIN_L + 8, y, 8, "F3", (0.12, 0.16, 0.22), line))
            y -= line_h
        self.y = y_bot - 8

    def table(self, headers: list[str], rows: list[list[str]], col_weights: list[float] | None = None) -> None:
        cols = len(headers)
        weights = col_weights or [1.0] * cols
        total_w = sum(weights)
        col_ws = [CONTENT_W * w / total_w for w in weights]
        font_size = 8.5
        pad_x, pad_y = 5.0, 4.0

        def row_height(cells: list[str]) -> float:
            max_lines = 1
            for cell, cw in zip(cells, col_ws):
                wrapped = wrap_text(cell, font_size, cw - pad_x * 2)
                max_lines = max(max_lines, len(wrapped))
            return max_lines * (font_size * 1.25) + pad_y * 2

        # Header
        h = row_height(headers)
        self.ensure_space(h + 2)
        x = MARGIN_L
        y_bot = self.y - h
        self.ops.append(("rect", x, y_bot, CONTENT_W, h, (0.93, 0.99, 0.96), (0.80, 0.84, 0.88)))
        cx = x
        for header, cw in zip(headers, col_ws):
            lines = wrap_text(header, font_size, cw - pad_x * 2)
            ty = self.y - pad_y - font_size
            for line in lines:
                self.ops.append(("text", cx + pad_x, ty, font_size, "F2", (0.02, 0.37, 0.27), line))
                ty -= font_size * 1.25
            cx += cw
        self.y = y_bot

        for i, row in enumerate(rows):
            h = row_height(row)
            self.ensure_space(h + 1)
            y_bot = self.y - h
            bg = (1, 1, 1) if i % 2 == 0 else (0.98, 0.99, 0.99)
            self.ops.append(("rect", MARGIN_L, y_bot, CONTENT_W, h, bg, (0.80, 0.84, 0.88)))
            cx = MARGIN_L
            for cell, cw in zip(row, col_ws):
                lines = wrap_text(cell, font_size, cw - pad_x * 2)
                ty = self.y - pad_y - font_size
                for line in lines:
                    self.ops.append(("text", cx + pad_x, ty, font_size, "F1", (0.06, 0.09, 0.16), line))
                    ty -= font_size * 1.25
                cx += cw
            self.y = y_bot
        self.spacer(8)

    def cover(self) -> None:
        self.new_page()
        # Accent bar
        self.ops.append(("rect", 36, 80, 6, PAGE_H - 160, (0.06, 0.46, 0.43), None))
        self.y = PAGE_H - 180
        self.draw_text("TECHNICAL DOCUMENTATION", size=9, bold=True, color=(0.06, 0.46, 0.43), indent=28, leading=14)
        self.spacer(10)
        self.draw_text("NovaPay", size=36, bold=True, indent=28, leading=42)
        self.spacer(8)
        self.draw_text(
            "Cross-border multi-currency digital banking platform for Africa-connected users, freelancers, diaspora senders, and businesses.",
            size=11,
            color=(0.30, 0.35, 0.42),
            indent=28,
            leading=16,
        )
        self.spacer(28)
        self.ops.append(("line", MARGIN_L + 28, self.y, MARGIN_L + 280, self.y, (0.80, 0.84, 0.88), 1))
        self.y -= 18
        meta = [
            ("Version", "1.0"),
            ("Date", "14 July 2026"),
            ("Scope", "Monorepo - NestJS API & Expo mobile (Phases 0-4 / F0-F7)"),
            ("Classification", "Internal project documentation"),
        ]
        for label, value in meta:
            self.draw_text(f"{label}:  {value}", size=10, indent=28, leading=15)
        self.spacer(40)
        self.draw_text(
            "Source of truth: apps/api, apps/mobile, and docs/ phase specifications.",
            size=9,
            color=(0.40, 0.45, 0.52),
            indent=28,
        )

    def finish_pages(self) -> None:
        if self.ops:
            self.pages.append(self.ops)
            self.ops = []

    def _page_stream(self, ops: list[tuple], page_index: int, total: int) -> bytes:
        parts: list[str] = []
        for op in ops:
            kind = op[0]
            if kind == "text":
                _, x, y, size, font, color, text = op
                r, g, b = color
                parts.append(
                    f"BT /{font} {size:.2f} Tf {r:.3f} {g:.3f} {b:.3f} rg "
                    f"1 0 0 1 {x:.2f} {y:.2f} Tm ({escape_pdf(text)}) Tj ET"
                )
            elif kind == "line":
                _, x1, y1, x2, y2, color, w = op
                r, g, b = color
                parts.append(
                    f"{w:.2f} w {r:.3f} {g:.3f} {b:.3f} RG {x1:.2f} {y1:.2f} m {x2:.2f} {y2:.2f} l S"
                )
            elif kind == "rect":
                _, x, y, w, h, fill, stroke = op
                if fill is not None:
                    fr, fg, fb = fill
                    parts.append(f"{fr:.3f} {fg:.3f} {fb:.3f} rg {x:.2f} {y:.2f} {w:.2f} {h:.2f} re f")
                if stroke is not None:
                    sr, sg, sb = stroke
                    parts.append(f"0.6 w {sr:.3f} {sg:.3f} {sb:.3f} RG {x:.2f} {y:.2f} {w:.2f} {h:.2f} re S")

        # Footer
        footer = f"NovaPay Documentation - Page {page_index}/{total}"
        parts.append(
            f"BT /F1 8 Tf 0.45 0.50 0.55 rg 1 0 0 1 {MARGIN_L:.2f} 28 Tm ({escape_pdf(footer)}) Tj ET"
        )
        stream = "\n".join(parts).encode("latin-1", errors="replace")
        return stream

    def build(self) -> bytes:
        self.finish_pages()
        total = len(self.pages)
        objects: list[bytes] = []

        def add(obj: bytes) -> int:
            objects.append(obj)
            return len(objects)

        # 1: Catalog -> 2: Pages tree
        add(b"<< /Type /Catalog /Pages 2 0 R >>")
        pages_obj_num = add(b"<< /Type /Pages /Kids [] /Count 0 >>")  # filled below

        # Fonts (must not collide with Pages object)
        font1 = add(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")
        font2 = add(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>")
        font3 = add(b"<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>")

        page_obj_nums: list[int] = []
        content_obj_nums: list[int] = []

        for i, ops in enumerate(self.pages, start=1):
            raw = self._page_stream(ops, i, total)
            compressed = zlib.compress(raw)
            content_num = add(
                f"<< /Length {len(compressed)} /Filter /FlateDecode >>\nstream\n".encode()
                + compressed
                + b"\nendstream"
            )
            content_obj_nums.append(content_num)
            page_num = add(b"")  # placeholder
            page_obj_nums.append(page_num)

        # Fill page objects
        for idx, page_num in enumerate(page_obj_nums):
            page_obj = (
                f"<< /Type /Page /Parent {pages_obj_num} 0 R "
                f"/MediaBox [0 0 {PAGE_W:.2f} {PAGE_H:.2f}] "
                f"/Contents {content_obj_nums[idx]} 0 R "
                f"/Resources << /Font << /F1 {font1} 0 R /F2 {font2} 0 R /F3 {font3} 0 R >> >> >>"
            ).encode()
            objects[page_num - 1] = page_obj

        kids = " ".join(f"{n} 0 R" for n in page_obj_nums)
        objects[pages_obj_num - 1] = (
            f"<< /Type /Pages /Kids [{kids}] /Count {total} >>".encode()
        )

        # Assemble PDF
        out = bytearray(b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n")
        offsets = [0]
        for i, obj in enumerate(objects, start=1):
            offsets.append(len(out))
            out.extend(f"{i} 0 obj\n".encode())
            out.extend(obj)
            out.extend(b"\nendobj\n")

        xref_pos = len(out)
        out.extend(f"xref\n0 {len(objects) + 1}\n".encode())
        out.extend(b"0000000000 65535 f \n")
        for off in offsets[1:]:
            out.extend(f"{off:010d} 00000 n \n".encode())
        out.extend(
            f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref_pos}\n%%EOF\n".encode()
        )
        return bytes(out)


def build_document() -> PdfDoc:
    d = PdfDoc()
    d.cover()

    # TOC
    d.new_page()
    d.heading1("Contents")
    toc = [
        "Introduction & Product Overview",
        "Repository Structure",
        "Technology Stack",
        "Core Features & User Flows",
        "API Architecture",
        "Database Schema",
        "Mobile Application",
        "Configuration & Environment",
        "Local Development Setup",
        "Phased Delivery Roadmap",
        "Security & Compliance Notes",
    ]
    for i, title in enumerate(toc, 1):
        d.numbered(i, title, size=11)
        d.spacer(2)

    # 1
    d.heading1("1. Introduction & Product Overview")
    d.para(
        "NovaPay is a cross-border, multi-currency digital banking platform built for Africa-connected users. "
        "It bridges local African financial rails (bank transfers and mobile money) with global currencies so people "
        "and businesses can hold, convert, send, receive, and spend money with transparent FX."
    )
    d.heading2("1.1 Purpose")
    for item in [
        "Hold balances in NGN, USD, and EUR",
        "Convert currencies with locked, transparent FX quotes",
        "Fund wallets and pay out to bank or mobile-money beneficiaries",
        "Issue virtual USD cards for online spend",
        "Receive inbound ACH/SEPA credits via virtual accounts",
        "Pay utility bills and buy airtime",
        "Deposit stablecoins and convert 1:1 to/from USD",
        "Operate business workspaces with roles and bulk payout approvals",
    ]:
        d.bullet(item)

    d.heading2("1.2 Target Users")
    d.table(
        ["Segment", "Needs"],
        [
            ["Individuals & freelancers", "Receive USD/EUR from global clients, convert to NGN, spend on virtual cards"],
            ["Diaspora senders", "Move money from UK/EU/US to Africa with clear rates and payout rails"],
            ["Businesses & organizations", "Multi-currency ops, team roles, dual-authorization bulk payouts, public API"],
        ],
        [0.35, 0.65],
    )

    # 2
    d.heading1("2. Repository Structure")
    d.para("NovaPay is a monorepo containing the backend API, the Expo mobile client, and phase documentation.")
    d.code_block(
        "NovaPay/\n"
        "+-- apps/\n"
        "|   +-- api/                 NestJS modular monolith (backend)\n"
        "|   +-- mobile/              Expo + React Native (frontend)\n"
        "+-- docs/\n"
        "|   +-- phase-0/ ... phase-4/  Backend phase specifications\n"
        "|   +-- frontend/            Mobile phase specifications (F0-F7)\n"
        "+-- docker-compose.yml       Local infrastructure (Redis)\n"
        "+-- .env.example             Environment template\n"
        "+-- README.md                Repository overview"
    )

    # 3
    d.heading1("3. Technology Stack")
    d.heading2("3.1 Backend (apps/api)")
    d.table(
        ["Layer", "Choice"],
        [
            ["Framework", "NestJS (TypeScript), modular monolith"],
            ["ORM", "Drizzle ORM"],
            ["Database", "PostgreSQL (Supabase hosting)"],
            ["Cache / locks", "Redis (ioredis)"],
            ["Auth", "Passport JWT (access + refresh tokens)"],
            ["Validation", "Zod (env), class-validator (DTOs)"],
            ["Logging", "Pino / nestjs-pino"],
            ["Health", "@nestjs/terminus"],
            ["Cloud target", "AWS (events via SNS/SQS or Kafka in later wiring)"],
        ],
        [0.28, 0.72],
    )
    d.heading2("3.2 Mobile (apps/mobile)")
    d.table(
        ["Layer", "Choice"],
        [
            ["Framework", "Expo SDK 54 + React Native + TypeScript"],
            ["Routing", "Expo Router (file-based, auth / tabs / modals)"],
            ["Typography", "Plus Jakarta Sans (UI), DM Sans (money/numbers)"],
            ["Secure storage", "expo-secure-store"],
            ["Biometrics", "expo-local-authentication"],
            ["Motion", "react-native-reanimated, gesture-handler"],
        ],
        [0.28, 0.72],
    )

    # 4
    d.heading1("4. Core Features & User Flows")
    d.heading2("4.1 Authentication & Onboarding")
    for i, step in enumerate(
        [
            "Welcome carousel introduces product value propositions.",
            "User enters phone number in E.164 format.",
            "SMS OTP is issued (Redis-backed). Sandbox supports fixed code 000000.",
            "User sets a 4-digit PIN for unlock and transaction authorization.",
            "Optional biometric opt-in (Face ID / Touch ID).",
        ],
        1,
    ):
        d.numbered(i, step)

    d.heading2("4.2 KYC")
    d.para(
        "Users submit identity documents (e.g. NIN, BVN, Passport). Sandbox can auto-approve submissions, "
        "moving users from tier_0 (restricted) to tier_1 (active). Payouts and card issuance require tier_1+; "
        "tier_0 single-payout limit is 0."
    )

    d.heading2("4.3 Wallets & Double-Entry Ledger")
    d.para(
        "Multi-currency wallets (NGN, USD, EUR). Every financial movement posts balanced debit/credit rows in "
        "ledger_entries. Wallet balance is the sum of ledger entries for that wallet. Amounts are stored as "
        "bigint minor units (kobo/cents)."
    )

    d.heading2("4.4 Funding")
    for i, step in enumerate(
        [
            "User selects Add Money on the NGN wallet and enters an amount.",
            "Payment rail: Flutterwave (live NGN rails) or mock/sandbox.",
            "Sandbox: simulate-complete credits the ledger immediately.",
        ],
        1,
    ):
        d.numbered(i, step)

    d.heading2("4.5 FX Conversion")
    for i, step in enumerate(
        [
            "User requests a quote (e.g. NGN <-> USD).",
            "Rate = mid-market + configurable margin (basis points).",
            "Quote locks for 60 seconds (TTL countdown in the app).",
            "Booking executes a double-entry transfer between wallets.",
        ],
        1,
    ):
        d.numbered(i, step)

    d.heading2("4.6 Send & Payouts")
    d.para(
        "Beneficiaries may be bank accounts or mobile money (MTN, Airtel, M-Pesa, etc.). "
        "Payouts require PIN authorization and are processed via Flutterwave or mock rails."
    )

    d.heading2("4.7 Virtual USD Cards")
    for item in [
        "Issue virtual Visa/Mastercard on the USD wallet.",
        "Full PANs are never stored - only last4, expiry, and processor references.",
        "Controls: freeze, unfreeze, close.",
        "Sandbox can simulate authorize -> settle against the USD ledger.",
    ]:
        d.bullet(item)

    d.heading2("4.8 Receive, Bills, Airtime, Stablecoins & Business")
    for item in [
        "Virtual USD/EUR receiving accounts (routing, IBAN, BIC, bank name).",
        "Simulate inbound ACH/SEPA credits in sandbox.",
        "Biller catalogs and airtime operators by country, paid with PIN gate.",
        "Deposit USDC/USDT; convert 1:1 to/from fiat USD.",
        "Organizations with roles: owner, admin, approver, member.",
        "Bulk payout batches with dual authorization above approval limits.",
        "Developer API keys (np_test_...) and webhook registration.",
    ]:
        d.bullet(item)

    # 5
    d.heading1("5. API Architecture")
    d.para(
        "The API is a NestJS modular monolith. Routes are versioned under /v1 and secured with JWT "
        "unless marked @Public()."
    )

    d.heading2("5.1 Auth & Profile")
    d.table(
        ["Method", "Endpoint", "Notes"],
        [
            ["POST", "/v1/auth/otp/request", "Public - request OTP"],
            ["POST", "/v1/auth/otp/verify", "Public - verify OTP, return JWTs"],
            ["POST", "/v1/auth/token/refresh", "Public - refresh access token"],
            ["GET", "/v1/auth/me", "Session hydrate (profile + KYC)"],
            ["PATCH", "/v1/auth/profile", "Update profile"],
            ["POST", "/v1/auth/kyc", "Submit KYC documents"],
        ],
        [0.14, 0.48, 0.38],
    )

    d.heading2("5.2 Wallets, Payments & Transactions")
    d.table(
        ["Method", "Endpoint", "Notes"],
        [
            ["GET", "/v1/wallets", "List wallets & balances"],
            ["GET", "/v1/payments/rail", "Active rail (mock / flutterwave)"],
            ["GET", "/v1/payments/banks/ng", "Nigerian bank list"],
            ["GET/POST", "/v1/beneficiaries", "List / add beneficiaries"],
            ["POST", "/v1/payments/fund", "Start wallet funding"],
            ["POST", "/v1/payments/fund/:id/simulate-complete", "Sandbox credit"],
            ["POST", "/v1/payments/payout", "Payout to beneficiary"],
            ["GET", "/v1/transactions", "Paginated history"],
            ["GET", "/v1/transactions/:id", "Transaction detail"],
            ["POST", "/v1/payments/flutterwave/webhook", "Public webhook"],
        ],
        [0.14, 0.52, 0.34],
    )

    d.heading2("5.3 FX & Cards")
    d.table(
        ["Method", "Endpoint", "Notes"],
        [
            ["GET", "/v1/fx/rate", "Live rates"],
            ["POST", "/v1/fx/quotes", "Create locked quote"],
            ["POST", "/v1/fx/quotes/:id/book", "Book quote / convert"],
            ["POST/GET", "/v1/cards", "Issue / list cards"],
            ["POST", "/v1/cards/:id/freeze|unfreeze|close", "Card controls"],
            ["POST", "/v1/cards/:id/authorize", "Sandbox auth hold"],
            ["POST", "/v1/cards/authorizations/:authId/settle", "Settle auth"],
        ],
        [0.14, 0.52, 0.34],
    )

    d.heading2("5.4 Receive, Bills, Stablecoins")
    d.table(
        ["Method", "Endpoint", "Notes"],
        [
            ["POST/GET", "/v1/accounts/virtual", "Create / list virtual accounts"],
            ["POST", "/v1/accounts/virtual/:id/simulate-inbound", "Sandbox inbound"],
            ["GET", "/v1/bills/catalog", "Billers by country"],
            ["GET", "/v1/airtime/operators", "Operators by country"],
            ["POST", "/v1/bills/pay", "Pay bill"],
            ["POST", "/v1/airtime/topup", "Airtime top-up"],
            ["GET", "/v1/stablecoins/balances", "Stablecoin balances"],
            ["POST", "/v1/stablecoins/deposit|convert", "Deposit / convert"],
        ],
        [0.14, 0.52, 0.34],
    )

    d.heading2("5.5 Business, Public API & Health")
    d.table(
        ["Method", "Endpoint", "Notes"],
        [
            ["POST/GET", "/v1/business/organizations", "Create / list orgs"],
            ["POST/GET", "/v1/business/organizations/:orgId/members", "Invite / list members"],
            ["GET/POST", "/v1/business/.../wallet", "Org wallet & fund"],
            ["POST", "/v1/business/.../bulk-payouts", "Submit / approve batches"],
            ["POST/GET", "/v1/developer/api-keys", "Create / list keys"],
            ["POST", "/v1/developer/api-keys/:id/revoke", "Revoke key"],
            ["POST/GET", "/v1/developer/webhooks", "Register / list webhooks"],
            ["GET", "/v1/public/wallets|transactions", "API-key gated public read"],
            ["GET", "/health", "Postgres, Redis, app checks"],
            ["GET", "/health/live", "Liveness probe"],
        ],
        [0.14, 0.50, 0.36],
    )

    # 6
    d.heading1("6. Database Schema")
    d.para(
        "PostgreSQL via Drizzle ORM. Monetary fields use bigint minor units to avoid floating-point error."
    )
    d.heading2("6.1 Important Enums")
    d.table(
        ["Enum", "Values (summary)"],
        [
            ["user_status", "pending, active, suspended, closed"],
            ["wallet_owner_type", "user, system, organization"],
            ["wallet_status", "active, frozen, closed"],
            ["ledger_direction", "debit, credit"],
            [
                "transaction_type",
                "fund, payout, transfer, convert, card_spend, receive, bill, airtime, stablecoin_*, bulk_payout, reversal, adjustment",
            ],
            ["transaction_status", "pending, processing, completed, failed, reversed"],
            ["beneficiary_type", "bank, mobile_money"],
            ["kyc_status", "pending, approved, rejected"],
            ["card_status", "active, frozen, closed"],
            ["fx_quote_status", "open, booked, expired"],
            ["org_role", "owner, admin, approver, member"],
            ["bulk_payout_status", "draft, pending_approval, processing, completed, failed, rejected"],
        ],
        [0.32, 0.68],
    )

    d.heading2("6.2 Core Tables")
    d.table(
        ["Table", "Role"],
        [
            ["users", "Phone, email, tag, status, KYC tier"],
            ["wallets", "Per-owner, per-currency fiat wallets"],
            ["transactions", "High-level money movement records + idempotency"],
            ["ledger_entries", "Double-entry rows; balance = sum by wallet"],
            ["beneficiaries", "Saved bank / MoMo recipients"],
            ["kyc_records", "Document verification trail"],
            ["fx_quotes", "Locked quotes with mid/client rate & TTL"],
            ["cards", "Virtual/physical cards (no full PAN)"],
            ["virtual_accounts", "Inbound receive account details"],
            ["organizations", "Business profiles + approval limits"],
            ["organization_members", "User <-> org role mapping"],
            ["bulk_payout_batches / items", "Org payout batches and line items"],
            ["api_keys", "Hashed developer keys + scopes"],
            ["webhook_endpoints", "Developer webhook subscriptions"],
        ],
        [0.38, 0.62],
    )
    d.para(
        "Ledger invariant: every completed financial action must produce balanced debit and credit ledger entries. "
        "The wallet balance is derived from the ledger, not stored as a mutable single column."
    )

    # 7
    d.heading1("7. Mobile Application")
    d.para("File-based routing lives under apps/mobile/app.")
    d.heading2("7.1 Auth & Onboarding Routes")
    d.table(
        ["Screen", "Purpose"],
        [
            ["(auth)/welcome", "Onboarding carousel"],
            ["(auth)/phone", "E.164 phone input"],
            ["(auth)/otp", "OTP verification"],
            ["(auth)/pin-setup", "Set 4-digit PIN"],
            ["(auth)/pin-unlock", "Cold-start unlock gate"],
            ["(auth)/kyc", "Document submission"],
        ],
        [0.35, 0.65],
    )
    d.heading2("7.2 Main Tabs")
    d.table(
        ["Tab", "Purpose"],
        [
            ["Home", "Wallet balances, currency toggle, quick actions, recent activity"],
            ["Cards", "Virtual cards list + USD balance"],
            ["Send", "Beneficiaries and send entry points"],
            ["Activity", "Full transaction history with filters"],
            ["Profile", "Profile, KYC tier, money tools links"],
        ],
        [0.22, 0.78],
    )
    d.heading2("7.3 Action Screens")
    d.para(
        "Fund, Convert, Add Beneficiary, Send Money, Create Card, Card Details, Bills, Receive, "
        "Stablecoins, Business workspace, Business org detail, Edit Profile, Change PIN."
    )

    # 8
    d.heading1("8. Configuration & Environment")
    d.heading2("8.1 API (apps/api/.env)")
    d.code_block(
        "NODE_ENV=development\n"
        "PORT=3000\n"
        "APP_NAME=novapay-api\n"
        "APP_URL=http://localhost:3000\n"
        "\n"
        "# Supabase Postgres\n"
        "# Transaction pooler (6543) for runtime\n"
        "DATABASE_URL=postgresql://...@...pooler.supabase.com:6543/postgres?sslmode=require\n"
        "# Direct / session (5432) for migrations\n"
        "DATABASE_URL_DIRECT=postgresql://...@...:5432/postgres?sslmode=require\n"
        "\n"
        "REDIS_URL=redis://localhost:6379\n"
        "JWT_ACCESS_SECRET=...   # >= 32 chars\n"
        "JWT_REFRESH_SECRET=...  # >= 32 chars\n"
        "JWT_ACCESS_TTL=15m\n"
        "JWT_REFRESH_TTL=30d\n"
        "\n"
        "OTP_DEV_FIXED_CODE=000000\n"
        "KYC_AUTO_APPROVE=true\n"
        "PAYMENT_RAIL=auto\n"
        "FX_USD_NGN_MID=1600\n"
        "FX_MARGIN_BPS=150\n"
        "FX_QUOTE_TTL_SECONDS=60\n"
        "CARD_ISSUER=mock"
    )
    d.heading2("8.2 Mobile")
    d.para("Set EXPO_PUBLIC_API_URL to the API base URL.")
    d.para(
        "Physical devices cannot use localhost - use your machine's LAN IP, e.g. http://192.168.x.x:3000."
    )
    d.heading2("8.3 Supabase Notes")
    for item in [
        "Runtime uses the transaction pooler URL (port 6543).",
        "Drizzle migrations use the direct/session URL (port 5432).",
        "SSL (sslmode=require) is required.",
        "Supabase is used as Postgres hosting only; auth/KYC remain in NestJS.",
    ]:
        d.bullet(item)

    # 9
    d.heading1("9. Local Development Setup")
    d.heading2("9.1 Infrastructure")
    d.code_block("docker compose up -d redis")
    d.heading2("9.2 API")
    d.code_block(
        "cd apps/api\n"
        "npm install\n"
        "cp ../../.env.example .env   # then fill Supabase + secrets\n"
        "npm run db:push\n"
        "npm run start:dev\n"
        "# Health: http://localhost:3000/health"
    )
    d.heading2("9.3 Mobile")
    d.code_block(
        "cd apps/mobile\n"
        "npm install\n"
        "\n"
        "# Simulator\n"
        "EXPO_PUBLIC_API_URL=http://localhost:3000 npx expo start\n"
        "\n"
        "# Physical device (use LAN IP)\n"
        "EXPO_PUBLIC_API_URL=http://192.168.1.50:3000 npx expo start --offline"
    )
    d.para("Open with iOS/Android simulator, or scan the QR code in Expo Go.")

    # 10
    d.heading1("10. Phased Delivery Roadmap")
    d.heading2("10.1 Backend Phases")
    d.table(
        ["Phase", "Focus"],
        [
            ["0", "Scaffold NestJS, Supabase Postgres, Redis; partners & regulatory notes"],
            ["1", "OTP auth, KYC, NGN double-entry ledger, fund & payout (mock/Flutterwave)"],
            ["2", "FX quotes, NGN <-> USD conversion, virtual USD cards"],
            ["3", "Virtual receive accounts, MoMo payouts, bills & airtime sandbox"],
            ["4", "Organizations, bulk payouts, stablecoins, public API keys & webhooks"],
        ],
        [0.15, 0.85],
    )
    d.heading2("10.2 Frontend Phases")
    d.table(
        ["Phase", "Focus"],
        [
            ["F0", "Design system, typography, tab shell"],
            ["F1", "Welcome, OTP, PIN lock, KYC"],
            ["F2", "Home wallets, fund modal, activity"],
            ["F3", "FX convert + send / beneficiaries"],
            ["F4", "Virtual cards + controls + simulated spend"],
            ["F5", "Bills, airtime, receive accounts"],
            ["F6", "Stablecoin deposit & convert"],
            ["F7", "Business orgs, invites, bulk payout approvals"],
        ],
        [0.15, 0.85],
    )
    d.para("Detailed specifications live in docs/phase-* and docs/frontend/phase-f*.")

    # 11
    d.heading1("11. Security & Compliance Notes")
    for item in [
        "JWT access tokens are short-lived; refresh tokens rotate over a longer TTL.",
        "Session material and PIN unlock are protected on-device via SecureStore and optional biometrics.",
        "Card PANs are not persisted in the application database.",
        "API keys are stored hashed; only prefixes are returned after creation.",
        "Payment and BaaS webhooks are public endpoints and must validate provider signatures/hashes.",
        "KYC tiers gate high-risk actions (payouts, card issuance).",
        "Idempotency keys on critical money-moving endpoints prevent duplicate posts.",
        "Regulatory pathways and partner shortlists are documented under docs/phase-0/ (REGULATORY.md, PARTNERS.md).",
    ]:
        d.bullet(item)

    d.spacer(16)
    d.para(
        "NovaPay Project Documentation v1.0 - Generated 14 July 2026. "
        "This document summarizes the implemented monorepo for onboarding, architecture review, and delivery tracking."
    )
    return d


def main() -> None:
    out = Path(__file__).with_name("NovaPay-Documentation.pdf")
    pdf = build_document().build()
    out.write_bytes(pdf)
    print(f"Wrote {out} ({len(pdf)} bytes)")


if __name__ == "__main__":
    main()
