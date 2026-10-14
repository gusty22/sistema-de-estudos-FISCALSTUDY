import sys
import argparse
import pymupdf
from pathlib import Path

def main():
    parser = argparse.ArgumentParser(description="Render a PDF page to PNG for visual inspection")
    parser.add_argument("--pdf", required=True, help="Path to PDF file")
    parser.add_argument("--page", type=int, default=1, help="Page number (1-indexed)")
    parser.add_argument("--output", required=True, help="Output PNG path")
    parser.add_argument("--dpi", type=int, default=150, help="Rendering DPI (default 150)")
    args = parser.parse_args()

    pdf_path = Path(args.pdf)
    if not pdf_path.exists():
        # Try prepending acervo root if relative
        alt_path = Path(r"C:\Users\washi\Downloads\provas") / args.pdf
        if alt_path.exists():
            pdf_path = alt_path
        else:
            print(f"Error: PDF not found: {args.pdf}", file=sys.stderr)
            sys.exit(1)

    out_path = Path(args.output)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    try:
        doc = pymupdf.open(str(pdf_path))
        if args.page < 1 or args.page > len(doc):
            print(f"Error: Page {args.page} out of bounds (1-{len(doc)})", file=sys.stderr)
            sys.exit(2)
        
        page = doc[args.page - 1]
        pix = page.get_pixmap(dpi=args.dpi)
        pix.save(str(out_path))
        print(f"SUCCESS: Rendered page {args.page} to {out_path} ({out_path.stat().st_size} bytes)")
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(3)

if __name__ == "__main__":
    main()
