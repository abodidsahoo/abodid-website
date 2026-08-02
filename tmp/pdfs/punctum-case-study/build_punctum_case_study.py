from __future__ import annotations

from io import BytesIO
from pathlib import Path

from PIL import Image, ImageDraw
from reportlab.lib.colors import HexColor
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
from reportlab.platypus import Paragraph


ROOT = Path("/Users/abodid/Documents/GitHub/personal-site")
SCREENS = ROOT / "tmp/pdfs/punctum-case-study/screens"
OUTPUT = ROOT / "output/pdf/punctum-experiment-case-study.pdf"

W, H = A4
M = 42

INK = HexColor("#202124")
MUTED = HexColor("#666A70")
FAINT = HexColor("#9B9FA5")
PAPER = HexColor("#F7F3EA")
WHITE = HexColor("#FFFFFF")
LINE = HexColor("#D7D2C7")
BLUE = HexColor("#3B7CE8")
BLUE_PALE = HexColor("#E9F0FE")
RED = HexColor("#E65749")
RED_PALE = HexColor("#FCEDEA")
YELLOW = HexColor("#F2C94C")
YELLOW_PALE = HexColor("#FFF7D9")
GREEN = HexColor("#58B86A")
GREEN_PALE = HexColor("#EAF7EC")
CHARCOAL = HexColor("#17191F")

FONT_REG = "PortfolioArial"
FONT_BOLD = "PortfolioArialBold"
FONT_ITALIC = "PortfolioArialItalic"

pdfmetrics.registerFont(
    TTFont(FONT_REG, "/System/Library/Fonts/Supplemental/Arial.ttf")
)
pdfmetrics.registerFont(
    TTFont(FONT_BOLD, "/System/Library/Fonts/Supplemental/Arial Bold.ttf")
)
pdfmetrics.registerFont(
    TTFont(FONT_ITALIC, "/System/Library/Fonts/Supplemental/Arial Italic.ttf")
)


def style(name: str, size: float, leading: float, color=INK, font=FONT_REG, **kwargs):
    return ParagraphStyle(
        name,
        fontName=font,
        fontSize=size,
        leading=leading,
        textColor=color,
        alignment=TA_LEFT,
        spaceAfter=0,
        spaceBefore=0,
        allowWidows=0,
        allowOrphans=0,
        **kwargs,
    )


BODY = style("Body", 10.2, 15.0)
BODY_SMALL = style("BodySmall", 8.6, 12.2, color=MUTED)
BODY_TINY = style("BodyTiny", 7.2, 10.0, color=MUTED)
H1 = style("H1", 31, 34, font=FONT_BOLD)
H2 = style("H2", 18, 21.5, font=FONT_BOLD)
H3 = style("H3", 11.5, 14.5, font=FONT_BOLD)
BIG = style("Big", 24, 27.5, font=FONT_BOLD)
QUOTE = style("Quote", 20, 24.5, font=FONT_BOLD)
CARD_BODY = style("CardBody", 8.7, 12.4, color=MUTED)
FLOW_BODY = style("FlowBody", 8.25, 11.4, color=MUTED)
SOURCE = style("Source", 7.1, 9.7, color=MUTED)


def p(c, text: str, x: float, top: float, width: float, paragraph_style=BODY) -> float:
    para = Paragraph(text, paragraph_style)
    _, height = para.wrap(width, H)
    para.drawOn(c, x, top - height)
    return height


def label(c, text: str, x: float, y: float, color=MUTED, size: float = 7.2):
    c.saveState()
    c.setFillColor(color)
    text_object = c.beginText(x, y)
    text_object.setFont(FONT_BOLD, size)
    text_object.setCharSpace(1.15)
    text_object.textLine(text.upper())
    c.drawText(text_object)
    c.restoreState()


def pill(c, text: str, x: float, y: float, fill, color=INK, width=None):
    c.setFont(FONT_BOLD, 7.4)
    tw = pdfmetrics.stringWidth(text, FONT_BOLD, 7.4)
    w = width or tw + 20
    c.setFillColor(fill)
    c.roundRect(x, y, w, 22, 11, stroke=0, fill=1)
    c.setFillColor(color)
    c.drawCentredString(x + w / 2, y + 7.2, text)
    return w


def card(c, x: float, y: float, w: float, h: float, fill=WHITE, stroke=LINE, radius=14):
    c.setFillColor(fill)
    c.setStrokeColor(stroke)
    c.setLineWidth(0.7)
    c.roundRect(x, y, w, h, radius, stroke=1, fill=1)


def dots(c, x: float, y: float, r: float = 3.2, gap: float = 9):
    for dx, dy, color in [
        (0, gap, BLUE),
        (gap, gap, RED),
        (0, 0, YELLOW),
        (gap, 0, GREEN),
    ]:
        c.setFillColor(color)
        c.circle(x + dx, y + dy, r, stroke=0, fill=1)


_image_cache = {}


def rounded_crop(path: Path, target_ratio: float, radius_px: int = 24):
    key = (str(path), round(target_ratio, 5), radius_px)
    if key in _image_cache:
        return _image_cache[key]

    image = Image.open(path).convert("RGBA")
    iw, ih = image.size
    source_ratio = iw / ih
    if source_ratio > target_ratio:
        new_w = int(ih * target_ratio)
        left = (iw - new_w) // 2
        image = image.crop((left, 0, left + new_w, ih))
    else:
        new_h = int(iw / target_ratio)
        top = (ih - new_h) // 2
        image = image.crop((0, top, iw, top + new_h))

    mask = Image.new("L", image.size, 0)
    draw = ImageDraw.Draw(mask)
    draw.rounded_rectangle(
        (0, 0, image.size[0] - 1, image.size[1] - 1),
        radius=radius_px,
        fill=255,
    )
    image.putalpha(mask)
    buffer = BytesIO()
    image.save(buffer, format="PNG")
    buffer.seek(0)
    reader = ImageReader(buffer)
    _image_cache[key] = (reader, buffer)
    return _image_cache[key]


def image_card(c, path: Path, x: float, y: float, w: float, h: float, border=LINE):
    c.setFillColor(WHITE)
    c.setStrokeColor(border)
    c.setLineWidth(0.8)
    c.roundRect(x - 3, y - 3, w + 6, h + 6, 13, stroke=1, fill=1)
    reader, _ = rounded_crop(path, w / h)
    c.drawImage(reader, x, y, width=w, height=h, preserveAspectRatio=False, mask="auto")


def add_link(c, text: str, url: str, x: float, y: float, width: float, size=7.0):
    c.setFillColor(BLUE)
    c.setFont(FONT_BOLD, size)
    c.drawString(x, y, text)
    c.linkURL(url, (x, y - 2, x + width, y + size + 2), relative=0)


def page_base(c, page_num: int, section: str, background=PAPER):
    c.setFillColor(background)
    c.rect(0, 0, W, H, stroke=0, fill=1)
    dots(c, M, H - 35, 2.6, 7.5)
    label(c, section, M + 29, H - 35, MUTED, 7)
    c.setStrokeColor(LINE)
    c.setLineWidth(0.55)
    c.line(M, 38, W - M, 38)
    c.setFillColor(MUTED)
    c.setFont(FONT_REG, 7.2)
    c.drawString(M, 22, "PUNCTUM / PORTFOLIO CASE STUDY")
    c.drawRightString(W - M, 22, f"{page_num:02d}")


def bookmark(c, name: str, title: str):
    c.bookmarkPage(name)
    c.addOutlineEntry(title, name, level=0, closed=False)


def cover(c):
    bookmark(c, "cover", "Punctum")
    c.setFillColor(PAPER)
    c.rect(0, 0, W, H, stroke=0, fill=1)
    dots(c, M, H - 49, 3.1, 9)
    label(c, "Photographic research experiment", M + 34, H - 48, MUTED, 7.2)

    c.setFillColor(INK)
    c.setFont(FONT_BOLD, 54)
    c.drawString(M, H - 145, "Punctum")
    p(
        c,
        "A study of situated attention, shared meaning,<br/>and what happens when an image meets many viewers.",
        M,
        H - 170,
        W - 2 * M,
        style("CoverSub", 17, 22, color=MUTED),
    )

    pill(c, "PORTFOLIO CASE STUDY", M, H - 252, BLUE_PALE, BLUE)
    pill(c, "PRODUCT + RESEARCH", M + 145, H - 252, YELLOW_PALE, INK)
    pill(c, "AUGUST 2026", M + 286, H - 252, GREEN_PALE, GREEN)

    image_card(c, SCREENS / "01-landing.png", M, 98, W - 2 * M, 287)
    p(
        c,
        "One image. Many encounters. The work invites people to mark the detail that pulls them in, then makes those private reactions visible together.",
        M,
        78,
        W - 2 * M,
        BODY_SMALL,
    )
    c.setFillColor(MUTED)
    c.setFont(FONT_REG, 7.2)
    c.drawString(M, 22, "DESIGNED AND DEVELOPED BY ABODID SAHOO")
    c.drawRightString(W - M, 22, "CASE STUDY / 01")
    c.showPage()


def page_idea(c):
    bookmark(c, "idea", "The idea")
    page_base(c, 2, "01 / The idea")
    label(c, "Core premise", M, H - 85, BLUE)
    p(c, "The image changes<br/>with the person.", M, H - 104, W - 2 * M, H1)
    p(
        c,
        "Punctum is an interactive photography experiment. A participant sees six fixed photographs and draws over the one thing that holds their attention. A short note can add memory, feeling, or association. The marks then become a shared visual archive.",
        M,
        H - 192,
        235,
        BODY,
    )
    image_card(c, SCREENS / "02-premise.png", 310, H - 302, 243, 137)
    p(c, "The opening frames difference as the subject of the study.", 310, H - 316, 243, BODY_TINY)

    items = [
        (
            "01",
            "Share authorship",
            "The photographer begins the image. Viewers complete its meaning. Multiple readings gently loosen the photographer's ownership of interpretation.",
            BLUE_PALE,
            BLUE,
        ),
        (
            "02",
            "Make attention visible",
            "A fleeting response becomes a drawn region. The interface gives subjective attention a visible, comparable form without asking for expert language.",
            RED_PALE,
            RED,
        ),
        (
            "03",
            "Study cultural difference",
            "Age, gender, country, language, memory, and locality may shape what becomes salient. Group maps create questions for comparison.",
            YELLOW_PALE,
            HexColor("#A67A00"),
        ),
        (
            "04",
            "Test context",
            "The selected fragment is placed in an AI-generated world. The viewer looks again and reports whether the punctum stayed, moved, or disappeared.",
            GREEN_PALE,
            GREEN,
        ),
    ]
    positions = [(M, 326), (306, 326), (M, 126), (306, 126)]
    for (num, title, body, fill, accent), (x, y) in zip(items, positions):
        card(c, x, y, 247, 170, fill=WHITE)
        c.setFillColor(fill)
        c.circle(x + 28, y + 140, 14, stroke=0, fill=1)
        c.setFillColor(accent)
        c.setFont(FONT_BOLD, 8)
        c.drawCentredString(x + 28, y + 137.2, num)
        p(c, title, x + 51, y + 151, 174, H3)
        p(c, body, x + 18, y + 112, 211, CARD_BODY)

    c.showPage()


def page_theory(c):
    bookmark(c, "theory", "Conceptual frame")
    page_base(c, 3, "02 / Conceptual frame")
    label(c, "Camera Lucida + visual sociology", M, H - 85, RED)
    p(c, "A theory of looking,<br/>made interactive.", M, H - 104, W - 2 * M, H1)

    theory_cards = [
        (
            "Studium and punctum",
            "Barthes separates a photograph's learned, cultural field of interest from the small detail that personally pricks a viewer. Punctum turns that private detail into the experiment's main input. [1]",
            BLUE_PALE,
            BLUE,
        ),
        (
            "The photographer loses final say",
            "The same move echoes Barthes's writing on authorship. Meaning is produced again at reception. Here, the viewer's hand literally redraws the photograph's center of gravity. [2]",
            RED_PALE,
            RED,
        ),
        (
            "Attention is situated",
            "Haraway's account of partial perspective offers a useful companion idea. Looking always comes from somewhere. The project records that position lightly through optional demographic context. [3]",
            GREEN_PALE,
            GREEN,
        ),
        (
            "Culture can pattern a gaze",
            "Scene-perception studies found group differences in object and background attention. Punctum extends the question to open-ended exhibition photographs. These studies motivate comparison; they do not define whole cultures. [4][5]",
            YELLOW_PALE,
            HexColor("#A67A00"),
        ),
    ]
    coords = [(M, 472), (306, 472), (M, 285), (306, 285)]
    for (title, body, fill, accent), (x, y) in zip(theory_cards, coords):
        card(c, x, y, 247, 162, fill=WHITE)
        c.setFillColor(fill)
        c.roundRect(x + 16, y + 116, 35, 28, 8, stroke=0, fill=1)
        c.setFillColor(accent)
        c.circle(x + 33.5, y + 130, 4, stroke=0, fill=1)
        p(c, title, x + 61, y + 142, 165, H3)
        p(c, body, x + 16, y + 104, 215, CARD_BODY)

    label(c, "The techno-social move", M, 236, BLUE)
    p(
        c,
        "Technology acts as the apparatus. Social meaning remains the subject.",
        M,
        218,
        W - 2 * M,
        style("TechMove", 13, 16, font=FONT_BOLD),
    )
    boxes = [
        ("PHOTO", "A fixed image", BLUE_PALE, BLUE),
        ("GESTURE", "A marked region", RED_PALE, RED),
        ("ARCHIVE", "Many situated views", YELLOW_PALE, HexColor("#A67A00")),
        ("NEW WORLD", "A second look", GREEN_PALE, GREEN),
    ]
    bx = [M, 174, 306, 438]
    for idx, ((topline, sub, fill, accent), x) in enumerate(zip(boxes, bx)):
        card(c, x, 89, 115, 83, fill=fill, stroke=fill, radius=12)
        label(c, topline, x + 12, 145, accent, 6.4)
        p(c, sub, x + 12, 133, 91, style("TechBox", 8.8, 11, font=FONT_BOLD))
        if idx < 3:
            c.setStrokeColor(FAINT)
            c.setFillColor(FAINT)
            c.setLineWidth(1)
            c.line(x + 118, 130, x + 127, 130)
            c.line(x + 124, 133, x + 127, 130)
            c.line(x + 124, 127, x + 127, 130)

    c.showPage()


def page_entry_questions(c):
    bookmark(c, "questions", "Entry points and questions")
    page_base(c, 4, "03 / Entry points + questions")
    label(c, "Participant journey", M, H - 85, GREEN)
    p(c, "Easy to enter.<br/>Specific in what it asks.", M, H - 104, W - 2 * M, H1)

    card(c, M, 490, 247, 150, fill=WHITE)
    label(c, "How people arrive", M + 17, 615, BLUE)
    p(
        c,
        "<b>Home</b> - Start Exploring<br/><b>Participate</b> - direct experiment route<br/><b>About</b> - Lend your attention<br/><b>Results</b> - Add your punctum or Play again<br/><b>Shared links</b> - copy, email, or WhatsApp",
        M + 17,
        596,
        212,
        BODY_SMALL,
    )

    card(c, 306, 490, 247, 150, fill=WHITE)
    label(c, "What a participant contributes", 323, 615, RED)
    p(
        c,
        "Optional age band, gender, and country.<br/>Required 18+ confirmation and research consent.<br/>One drawn region per photograph.<br/>An optional note in the participant's own words.<br/>A second mark after AI recontextualization, if they continue.",
        323,
        596,
        212,
        BODY_SMALL,
    )

    label(c, "Questions inside the experience", M, 458, BLUE)
    questions = [
        ("01", "What draws you in?", "Draw over the one thing that draws your attention the most."),
        ("02", "Is this your punctum?", "Confirm the region that pulled you in."),
        ("03", "What happened there?", "Describe what you noticed, remembered, felt, or imagined."),
        ("04", "Did context change it?", "In the AI world: still, moved, disappeared, or unsure?"),
    ]
    y = 416
    for num, title, body in questions:
        c.setFillColor(BLUE_PALE if int(num) % 2 else YELLOW_PALE)
        c.circle(M + 16, y + 4, 14, stroke=0, fill=1)
        c.setFillColor(BLUE if int(num) % 2 else HexColor("#A67A00"))
        c.setFont(FONT_BOLD, 7.5)
        c.drawCentredString(M + 16, y + 1.5, num)
        p(c, title, M + 42, y + 16, 160, H3)
        p(c, body, M + 204, y + 16, 349, BODY_SMALL)
        y -= 48

    image_card(c, SCREENS / "03-profile.png", M, 74, 247, 139)
    image_card(c, SCREENS / "04-consent.png", 306, 74, 247, 139)
    p(c, "Optional context keeps entry lightweight.", M, 61, 247, BODY_TINY)
    p(c, "Consent sits before any response is recorded.", 306, 61, 247, BODY_TINY)
    c.showPage()


def draw_arrow(c, x: float, y_top: float, y_bottom: float):
    c.setStrokeColor(FAINT)
    c.setFillColor(FAINT)
    c.setLineWidth(1.15)
    c.line(x, y_top, x, y_bottom)
    c.line(x - 3, y_bottom + 4, x, y_bottom)
    c.line(x + 3, y_bottom + 4, x, y_bottom)


def page_pipeline(c):
    bookmark(c, "pipeline", "Experience pipeline")
    page_base(c, 5, "04 / Experience pipeline")
    label(c, "End-to-end flow", M, H - 85, YELLOW if YELLOW else BLUE)
    p(c, "The experience pipeline.", M, H - 104, W - 2 * M, H1)
    p(
        c,
        "From private attention to a recursive public archive.",
        M,
        H - 148,
        W - 2 * M,
        BODY_SMALL,
    )

    steps = [
        ("01", "Arrive", "Home, About, Results, direct link, or a shared result.", BLUE_PALE, BLUE),
        ("02", "Prepare", "Optional profile, consent, human check, and a quick practice mark.", GREEN_PALE, GREEN),
        ("03", "Encounter", "View six fixed exhibition photographs in a stable sequence.", YELLOW_PALE, HexColor("#A67A00")),
        ("04", "Declare a punctum", "Draw one region, inspect the fitted shape, and confirm it.", RED_PALE, RED),
        ("05", "Add words", "Optionally describe what was noticed, remembered, felt, or imagined.", BLUE_PALE, BLUE),
        ("06", "Gather and compare", "See constellations, individual notes, counts, and privacy-safe cohorts.", GREEN_PALE, GREEN),
        ("07", "Recontextualize", "Use the isolated fragment, context crop, note, and palette to build an AI world.", YELLOW_PALE, HexColor("#A67A00")),
        ("08", "Look again", "Report whether the punctum stayed, moved, disappeared, or became uncertain. Mark again to continue.", RED_PALE, RED),
    ]

    box_x = 61
    box_w = W - 122
    box_h = 58
    start_y = 610
    gap = 15
    for idx, (num, title, body, fill, accent) in enumerate(steps):
        y = start_y - idx * (box_h + gap)
        card(c, box_x, y, box_w, box_h, fill=WHITE, radius=13)
        c.setFillColor(fill)
        c.roundRect(box_x + 12, y + 12, 42, 34, 10, stroke=0, fill=1)
        c.setFillColor(accent)
        c.setFont(FONT_BOLD, 9)
        c.drawCentredString(box_x + 33, y + 24.5, num)
        p(c, title, box_x + 68, y + 43, 132, H3)
        p(c, body, box_x + 205, y + 43, box_w - 222, FLOW_BODY)
        if idx < len(steps) - 1:
            draw_arrow(c, W / 2, y - 2, y - gap + 3)

    loop_y = 57
    card(c, 115, loop_y, W - 230, 31, fill=CHARCOAL, stroke=CHARCOAL, radius=15)
    c.setFillColor(WHITE)
    c.setFont(FONT_BOLD, 7.8)
    c.drawCentredString(W / 2, loop_y + 10.5, "THE NEW MARK CAN START ANOTHER WORLD - THE LINEAGE CONTINUES")
    c.showPage()


def metric(c, x, y, w, value, label_text, fill, accent):
    card(c, x, y, w, 72, fill=fill, stroke=fill, radius=12)
    c.setFillColor(accent)
    c.setFont(FONT_BOLD, 22)
    c.drawString(x + 14, y + 36, value)
    p(c, label_text, x + 14, y + 27, w - 28, style("Metric", 7.2, 9, color=MUTED))


def page_results(c):
    bookmark(c, "results", "Collective results")
    page_base(c, 6, "05 / Collective outcomes")
    label(c, "Live product snapshot", M, H - 85, BLUE)
    p(c, "Where attention gathered.", M, H - 104, W - 2 * M, H1)
    p(
        c,
        "A live capture on 2 August 2026 showed 79 visible marks across the six photographs. Counts describe marks per image, not unique participants or final research findings.",
        M,
        H - 151,
        W - 2 * M,
        BODY_SMALL,
    )

    mw = (W - 2 * M - 30) / 4
    metric(c, M, 590, mw, "6", "fixed photographs", BLUE_PALE, BLUE)
    metric(c, M + mw + 10, 590, mw, "79", "visible marks", RED_PALE, RED)
    metric(c, M + 2 * (mw + 10), 590, mw, "34", "marks on image 01", YELLOW_PALE, HexColor("#A67A00"))
    metric(c, M + 3 * (mw + 10), 590, mw, "10", "minimum cohort", GREEN_PALE, GREEN)

    image_card(c, SCREENS / "06-constellation.png", M, 289, W - 2 * M, 287)
    p(
        c,
        "Constellation view layers every valid polygon over the same photograph. A viewer can open a mark to read its anonymous note.",
        M,
        275,
        W - 2 * M,
        BODY_TINY,
    )

    image_card(c, SCREENS / "05-results-gallery.png", M, 89, 247, 139)
    image_card(c, SCREENS / "07-individuals.png", 306, 89, 247, 139)
    p(c, "The gallery makes response density legible.", M, 75, 247, BODY_TINY)
    p(c, "Individual cards keep the mark and words together.", 306, 75, 247, BODY_TINY)
    c.showPage()


def page_wow(c):
    bookmark(c, "wow", "The wow factor")
    page_base(c, 7, "06 / The wow factor")
    label(c, "Context becomes experimental material", M, H - 85, RED)
    p(c, "The punctum becomes<br/>a generative seed.", M, H - 104, W - 2 * M, BIG)
    p(
        c,
        "The system isolates the selected polygon, keeps a contextual crop, carries the viewer's words, samples the fragment's palette, and asks an image model to build a coherent new photographic world around it.",
        M,
        H - 171,
        W - 2 * M,
        BODY_SMALL,
    )

    image_card(c, SCREENS / "09-generated-world.png", 60, 365, 475, 267)
    p(c, "The original mark remains visible beside the generated world.", 60, 352, 475, BODY_TINY)

    image_card(c, SCREENS / "10-reflection-question.png", 60, 67, 475, 267)
    p(
        c,
        "The second look turns spectacle into a research question: did the same detail survive the loss of its original context?",
        M,
        53,
        475,
        BODY_TINY,
    )
    c.showPage()


def outcome_card(c, x, y, w, h, number, title, body, fill, accent):
    card(c, x, y, w, h, fill=WHITE)
    c.setFillColor(fill)
    c.circle(x + 27, y + h - 28, 13, stroke=0, fill=1)
    c.setFillColor(accent)
    c.setFont(FONT_BOLD, 7.6)
    c.drawCentredString(x + 27, y + h - 30.5, number)
    p(c, title, x + 49, y + h - 18, w - 65, H3)
    p(c, body, x + 16, y + h - 58, w - 32, CARD_BODY)


def page_outcomes(c):
    bookmark(c, "outcomes", "Outcomes and product value")
    page_base(c, 8, "07 / Outcomes + product value")
    label(c, "What the system produces", M, H - 85, GREEN)
    p(c, "Several outcomes.<br/>One connected experience.", M, H - 104, W - 2 * M, H1)

    cards = [
        (
            "01",
            "For the participant",
            "A personal set of punctums, optional notes, and a way to revisit each mark. The AI world makes the participant notice their own attention changing.",
            BLUE_PALE,
            BLUE,
        ),
        (
            "02",
            "For the public",
            "An anonymous archive of marks and words. Constellation and individual views show agreement, drift, and private outliers without deciding which reading is correct.",
            RED_PALE,
            RED,
        ),
        (
            "03",
            "For research",
            "A structured record of polygon, centroid, area, drawing type, note, optional demographics, generated-world lineage, and post-generation reflection.",
            YELLOW_PALE,
            HexColor("#A67A00"),
        ),
        (
            "04",
            "For the photographer",
            "A visible lesson in distributed meaning. The image keeps its authorship, while interpretation becomes shared with the people who encounter it.",
            GREEN_PALE,
            GREEN,
        ),
    ]
    coords = [(M, 462), (306, 462), (M, 265), (306, 265)]
    for data, (x, y) in zip(cards, coords):
        outcome_card(c, x, y, 247, 174, *data)

    card(c, M, 82, W - 2 * M, 142, fill=CHARCOAL, stroke=CHARCOAL)
    label(c, "Success signals to watch", M + 18, 198, BLUE, 6.8)
    success_items = [
        "Session completion and photo skip rate",
        "How often a mark receives an optional note",
        "Spread and clustering of marked regions by image",
        "Cohort differences that survive the privacy threshold",
        "Still / moved / disappeared / unsure after recontextualization",
        "How often viewers draw a second punctum and continue the lineage",
    ]
    for idx, text in enumerate(success_items):
        col = idx % 2
        row = idx // 2
        x = M + 18 + col * 247
        y = 173 - row * 29
        c.setFillColor([BLUE, RED, YELLOW, GREEN][idx % 4])
        c.circle(x + 4, y + 3, 3.1, stroke=0, fill=1)
        p(c, text, x + 13, y + 11, 216, style("Success", 8.1, 10.6, color=WHITE))
    c.showPage()


def page_method(c):
    bookmark(c, "method", "Method, ethics, and limits")
    page_base(c, 9, "08 / Method + ethics")
    label(c, "Research integrity", M, H - 85, BLUE)
    p(c, "Method, ethics, and limits.", M, H - 104, W - 2 * M, H1)

    card(c, M, 410, 247, 267, fill=WHITE)
    label(c, "What is recorded", M + 17, 650, BLUE)
    recorded = [
        "Public session ID and completion time",
        "Optional age band, gender, country, and browser language",
        "Image version and checksum",
        "Polygon vertices, centroid, area, drawing type, and fit metadata",
        "Optional written annotation",
        "AI model, source fragment, palette, generated image, and lineage",
        "Post-generation answer, second polygon, and explanation",
    ]
    y = 621
    for idx, item in enumerate(recorded):
        c.setFillColor(BLUE if idx % 2 == 0 else GREEN)
        c.circle(M + 23, y + 2, 3.2, stroke=0, fill=1)
        h = p(c, item, M + 34, y + 9, 194, BODY_SMALL)
        y -= max(27, h + 10)

    card(c, 306, 410, 247, 267, fill=WHITE)
    label(c, "Guardrails in the product", 323, 650, GREEN)
    guards = [
        "18+ confirmation and explicit research consent before a session starts",
        "Human verification and session rate limits",
        "Optional demographics and optional notes",
        "Anonymous public display of valid marks",
        "Annotation moderation before public display",
        "Cohort suppression below 10 responses",
        "AI generation limits and session-bound editing access",
    ]
    y = 621
    for idx, item in enumerate(guards):
        c.setFillColor(GREEN if idx % 2 == 0 else YELLOW)
        c.circle(312 + 17, y + 2, 3.2, stroke=0, fill=1)
        h = p(c, item, 340, y + 9, 194, BODY_SMALL)
        y -= max(27, h + 10)

    card(c, M, 91, W - 2 * M, 292, fill=RED_PALE, stroke=RED_PALE)
    label(c, "Limits that should stay visible", M + 18, 356, RED)
    limitations = [
        (
            "Self-selection",
            "People who choose to participate may already be comfortable with photography or interactive research.",
        ),
        (
            "A fixed image set",
            "Six exhibition photographs from one photographer limit how widely findings can travel.",
        ),
        (
            "A mark is declared attention",
            "Drawing records what a viewer chooses to report. It is different from continuous eye tracking.",
        ),
        (
            "Demographics are context, not cause",
            "Differences between groups should invite qualitative follow-up. They should never harden into cultural stereotypes.",
        ),
        (
            "AI changes the apparatus",
            "Generated worlds carry model bias and aesthetic conventions. They test context while introducing a new source of influence.",
        ),
    ]
    y = 326
    for idx, (title, body) in enumerate(limitations):
        c.setFillColor(RED)
        c.setFont(FONT_BOLD, 8.6)
        c.drawString(M + 18, y, f"{idx + 1:02d}")
        p(c, title, M + 48, y + 10, 132, H3)
        p(c, body, M + 187, y + 10, 306, BODY_SMALL)
        y -= 52
    c.showPage()


def source_line(c, number, citation, link_text, url, y):
    c.setFillColor(BLUE_PALE if number % 2 else YELLOW_PALE)
    c.circle(M + 13, y + 5, 11, stroke=0, fill=1)
    c.setFillColor(BLUE if number % 2 else HexColor("#A67A00"))
    c.setFont(FONT_BOLD, 7.2)
    c.drawCentredString(M + 13, y + 2.3, str(number))
    h = p(c, citation, M + 36, y + 16, W - 2 * M - 36, SOURCE)
    add_link(c, link_text, url, M + 36, y - h + 3, 210, 6.8)
    return y - max(54, h + 29)


def page_sources(c):
    bookmark(c, "sources", "Takeaway and sources")
    page_base(c, 10, "09 / Takeaway + sources")
    label(c, "Portfolio takeaway", M, H - 85, RED)
    p(
        c,
        "Punctum turns a private<br/>reaction into shared inquiry.",
        M,
        H - 104,
        W - 2 * M,
        H1,
    )
    p(
        c,
        "Its strongest contribution is the loop. A photograph produces a mark. Many marks produce a collective image. One fragment produces a new world. The viewer returns to the question with altered context.",
        M,
        H - 180,
        W - 2 * M,
        BODY,
    )

    values = [
        ("RESEARCH", "A clear hypothesis made experiential", BLUE_PALE, BLUE),
        ("INTERACTION", "Drawing replaces specialist language", RED_PALE, RED),
        ("DATA", "Subjective response becomes structured geometry", YELLOW_PALE, HexColor("#A67A00")),
        ("AI", "Generation is used as a context test", GREEN_PALE, GREEN),
    ]
    x = M
    widths = [120, 120, 120, 121]
    for (topline, body, fill, accent), w in zip(values, widths):
        card(c, x, 513, w, 88, fill=fill, stroke=fill, radius=12)
        label(c, topline, x + 11, 575, accent, 6.1)
        p(c, body, x + 11, 561, w - 22, style("Value", 7.8, 10.2, font=FONT_BOLD))
        x += w + 10

    label(c, "Selected sources", M, 477, BLUE)
    y = 446
    y = source_line(
        c,
        1,
        "Roland Barthes. <i>Camera Lucida: Reflections on Photography</i>. Translated by Richard Howard. Hill and Wang, 1981.",
        "Publisher page",
        "https://us.macmillan.com/books/9780374532338/cameralucida/",
        y,
    )
    y = source_line(
        c,
        2,
        "Roland Barthes. 'The Death of the Author.' In <i>Image-Music-Text</i>, translated by Stephen Heath, 1977 [1967].",
        "University-hosted text",
        "https://sites.tufts.edu/english292b/files/2012/01/Barthes-The-Death-of-the-Author.pdf",
        y,
    )
    y = source_line(
        c,
        3,
        "Donna Haraway. 'Situated Knowledges: The Science Question in Feminism and the Privilege of Partial Perspective.' <i>Feminist Studies</i> 14(3), 1988.",
        "DOI record",
        "https://doi.org/10.2307/3178066",
        y,
    )
    y = source_line(
        c,
        4,
        "Takahiko Masuda and Richard E. Nisbett. 'Attending Holistically Versus Analytically.' <i>Journal of Personality and Social Psychology</i> 81(5), 2001.",
        "PubMed record",
        "https://pubmed.ncbi.nlm.nih.gov/11708567/",
        y,
    )
    y = source_line(
        c,
        5,
        "Hannah F. Chua, Julie E. Boland, and Richard E. Nisbett. 'Cultural Variation in Eye Movements During Scene Perception.' <i>PNAS</i> 102(35), 2005.",
        "PubMed record",
        "https://pubmed.ncbi.nlm.nih.gov/16116075/",
        y,
    )
    y = source_line(
        c,
        6,
        "Douglas Harper. 'Talking About Pictures: A Case for Photo Elicitation.' <i>Visual Studies</i> 17(1), 2002.",
        "DOI record",
        "https://doi.org/10.1080/14725860220137345",
        y,
    )
    y = source_line(
        c,
        7,
        "Product audit of the local Punctum implementation: participant flow, APIs, response schema, privacy logic, result views, and AI-world lineage. Captured 2 August 2026.",
        "Project page",
        "http://localhost:4321/research/punctum",
        y,
    )
    c.showPage()


def build():
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    c = canvas.Canvas(str(OUTPUT), pagesize=A4, pageCompression=1)
    c.setTitle("Punctum - Portfolio Case Study")
    c.setAuthor("Abodid Sahoo")
    c.setSubject("A portfolio and product research case study of the Punctum experiment")
    c.setCreator("Codex with ReportLab")
    cover(c)
    page_idea(c)
    page_theory(c)
    page_entry_questions(c)
    page_pipeline(c)
    page_results(c)
    page_wow(c)
    page_outcomes(c)
    page_method(c)
    page_sources(c)
    c.save()
    print(OUTPUT)


if __name__ == "__main__":
    build()
