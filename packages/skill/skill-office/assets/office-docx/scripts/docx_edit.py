#!/usr/bin/env python3
"""Safe run-preserving edits for .docx files.

Usage (subcommands, each self-contained so the model never edits whole runs):
  docx_edit.py replace SOURCE OUT TARGET_OLD NEW [--para IDX] [--run IDX]
  docx_edit.py insert_after SOURCE OUT TARGET_TEXT NEW_TEXT
  docx_edit.py table_add_row SOURCE OUT CELL1 CELL2 CELL3
  docx_edit.py inspect SOURCE
"""

import sys

from docx import Document


def _load(path):
    return Document(path)


def _arg_paragraph(doc, idx):
    try:
        return doc.paragraphs[int(idx)]
    except (ValueError, IndexError):
        raise SystemExit(f"no paragraph at index {idx}")


def _arg_run(doc, para, idx):
    if idx is None:
        return None
    try:
        return para.runs[int(idx)]
    except (ValueError, IndexError):
        raise SystemExit(f"paragraph has no run at index {idx}")


def _split_runs(para, old, new):
    """Distribute (old -> new) across runs, preserving each run's rPr."""
    runs = para.runs
    texts = [run.text for run in runs]
    full = "".join(texts)
    if old not in full:
        raise SystemExit(f"text {old!r} not found in paragraph")
    start = full.find(old)
    end = start + len(old)
    pos = 0
    idx_start = idx_end = None
    for i, text in enumerate(texts):
        next_pos = pos + len(text)
        if idx_start is None and start < next_pos:
            idx_start = i
            offset_start = start - pos
        if end <= next_pos:
            idx_end = i
            offset_end = end - pos
            break
        pos = next_pos
    head = texts[idx_start][:offset_start]
    if idx_start == idx_end:
        tail = texts[idx_start][offset_end:]
        runs[idx_start].text = head + new + tail
    else:
        runs[idx_start].text = head + new
        for i in range(idx_start + 1, idx_end):
            runs[i].text = ""
        runs[idx_end].text = texts[idx_end][offset_end:]


def _print_paragraph(para, idx):
    print(f"paragraph[{idx}] style={para.style.name!r} text={para.text!r}")
    for j, run in enumerate(para.runs):
        print(f"  run[{j}] bold={run.bold} italic={run.italic} text={run.text!r}")


def cmd_inspect(args):
    doc = _load(args[0])
    print(f"paragraphs={len(doc.paragraphs)} tables={len(doc.tables)}")
    for i, para in enumerate(doc.paragraphs):
        _print_paragraph(para, i)
    for t, table in enumerate(doc.tables):
        print(f"table[{t}] rows={len(table.rows)} cols={len(table.columns)}")


def cmd_replace(args):
    src, out, old, new = args[0], args[1], args[2], args[3]
    para_idx = None
    run_idx = None
    rest = args[4:]
    if "--para" in rest:
        para_idx = rest[rest.index("--para") + 1]
    if "--run" in rest:
        run_idx = rest[rest.index("--run") + 1]
    doc = _load(src)
    if para_idx is not None:
        para = _arg_paragraph(doc, para_idx)
        run = _arg_run(doc, para, run_idx)
        if run is None:
            _split_runs(para, old, new)
        else:
            if old not in run.text:
                raise SystemExit(f"run text does not contain {old!r}")
            run.text = run.text.replace(old, new, 1)
    else:
        for para in doc.paragraphs:
            if old in para.text:
                _split_runs(para, old, new)
                break
        else:
            raise SystemExit(f"text {old!r} not found in any paragraph")
    doc.save(out)
    print(f"saved {out}")


def cmd_insert_after(args):
    src, out, target, new_text = args[0], args[1], args[2], args[3]
    doc = _load(src)
    for i, para in enumerate(doc.paragraphs):
        if target in para.text:
            new_para = para.insert_paragraph_before("")
            para._p.addnext(new_para._p)
            run = new_para.add_run(new_text)
            run.text = new_text
            doc.save(out)
            print(f"inserted after paragraph[{i}]: {new_text!r}")
            return
    raise SystemExit(f"target text {target!r} not found")


def cmd_table_add_row(args):
    src, out = args[0], args[1]
    cells = args[2:]
    doc = _load(src)
    if not doc.tables:
        raise SystemExit("document has no tables")
    table = doc.tables[0]
    row = table.add_row()
    for i, cell in enumerate(cells):
        if i < len(row.cells):
            row.cells[i].text = cell
    doc.save(out)
    print(f"appended row to table[0]: {cells}")


def main(argv):
    if len(argv) < 2:
        raise SystemExit(__doc__)
    cmd, args = argv[1], argv[2:]
    if cmd == "inspect":
        cmd_inspect(args)
    elif cmd == "replace":
        cmd_replace(args)
    elif cmd == "insert_after":
        cmd_insert_after(args)
    elif cmd == "table_add_row":
        cmd_table_add_row(args)
    else:
        raise SystemExit(__doc__)


if __name__ == "__main__":
    main(sys.argv)