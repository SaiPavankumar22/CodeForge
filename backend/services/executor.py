import subprocess
import tempfile
import os
import sys
import time
import shutil
import shlex
from typing import List, Tuple, Optional

from core.config import settings
from models.schemas import Language, ExecutionStatus


def _which(*names: str) -> Optional[str]:
    for n in names:
        p = shutil.which(n)
        if p:
            return p
    return None


def _python_run_prefix() -> List[str]:
    if settings.PYTHON_EXECUTABLE:
        parts = shlex.split(settings.PYTHON_EXECUTABLE.strip(), posix=os.name != "nt")
        if "-u" not in parts:
            parts.append("-u")
        return parts
    if sys.platform == "win32":
        py = _which("python", "py", "python3")
        if py:
            base = os.path.basename(py).lower()
            if base == "py.exe" or base == "py":
                return [py, "-3", "-u"]
            return [py, "-u"]
    py = _which("python3", "python")
    if py:
        return [py, "-u"]
    return ["python", "-u"]


def _node_run_prefix() -> List[str]:
    if settings.NODE_EXECUTABLE:
        return shlex.split(settings.NODE_EXECUTABLE.strip(), posix=os.name != "nt")
    n = _which("node", "nodejs")
    return [n] if n else ["node"]


def _gpp_compile_cmd(binary_path: str, source_path: str) -> List[str]:
    compiler = settings.GPP_EXECUTABLE or _which("g++", "clang++") or "g++"
    return [compiler, "-O2", "-o", binary_path, source_path]


def _java_compile_cmd(source_path: str) -> List[str]:
    jc = settings.JAVAC_EXECUTABLE or _which("javac") or "javac"
    return [jc, source_path]


def _java_run_cmd(tmpdir: str) -> List[str]:
    java = settings.JAVA_EXECUTABLE or _which("java") or "java"
    return [java, "-cp", tmpdir, "Solution"]


def cpp_binary_path(tmpdir: str, base: str = "solution_bin") -> str:
    """After g++ -o, the actual file is .exe on Windows."""
    p = os.path.join(tmpdir, base)
    if sys.platform == "win32":
        pe = p + ".exe"
        if os.path.isfile(pe):
            return pe
    return p


def _run_process(cmd: list, stdin_data: str, timeout: int, cwd: str = None) -> Tuple[str, str, int, float]:
    """Run a subprocess and return (stdout, stderr, returncode, elapsed_ms)."""
    start = time.time()
    try:
        proc = subprocess.run(
            cmd,
            input=stdin_data,
            capture_output=True,
            text=True,
            timeout=timeout,
            cwd=cwd,
        )
        elapsed = (time.time() - start) * 1000
        return proc.stdout.strip(), proc.stderr.strip(), proc.returncode, elapsed
    except subprocess.TimeoutExpired:
        elapsed = (time.time() - start) * 1000
        return "", "Time Limit Exceeded", -1, elapsed
    except Exception as e:
        elapsed = (time.time() - start) * 1000
        return "", str(e), -2, elapsed


def execute_code(language: Language, code: str, stdin_input: str, time_limit: int = 10) -> Tuple[str, str, ExecutionStatus, float]:
    """
    Execute code for a given language with stdin.
    Returns (stdout, stderr, status, elapsed_ms).
    """
    if language not in (
        Language.PYTHON, Language.JAVASCRIPT, Language.CPP, Language.JAVA
    ):
        return "", f"Unsupported language: {language}", ExecutionStatus.RUNTIME_ERROR, 0.0

    with tempfile.TemporaryDirectory() as tmpdir:
        try:
            if language == Language.JAVA:
                source_path = os.path.join(tmpdir, "Solution.java")
            elif language == Language.PYTHON:
                source_path = os.path.join(tmpdir, "solution.py")
            elif language == Language.JAVASCRIPT:
                source_path = os.path.join(tmpdir, "solution.js")
            else:
                source_path = os.path.join(tmpdir, "solution.cpp")

            with open(source_path, "w", encoding="utf-8", newline="\n") as f:
                f.write(code)

            run_cmd: List[str]

            if language == Language.PYTHON:
                run_cmd = _python_run_prefix() + [source_path]
            elif language == Language.JAVASCRIPT:
                run_cmd = _node_run_prefix() + [source_path]
            elif language == Language.CPP:
                binary_base = os.path.join(tmpdir, "solution_bin")
                compile_cmd = _gpp_compile_cmd(binary_base, source_path)
                _, compile_err, rc, _ = _run_process(compile_cmd, "", 30, cwd=tmpdir)
                if rc != 0:
                    return "", compile_err, ExecutionStatus.COMPILATION_ERROR, 0.0
                run_cmd = [cpp_binary_path(tmpdir)]
            else:  # JAVA
                compile_cmd = _java_compile_cmd(source_path)
                _, compile_err, rc, _ = _run_process(compile_cmd, "", 30, cwd=tmpdir)
                if rc != 0:
                    return "", compile_err, ExecutionStatus.COMPILATION_ERROR, 0.0
                run_cmd = _java_run_cmd(tmpdir)

            stdout, stderr, rc, elapsed_ms = _run_process(
                run_cmd, stdin_input, time_limit, cwd=tmpdir
            )

            if stderr == "Time Limit Exceeded" or rc == -1:
                return "", "Time Limit Exceeded", ExecutionStatus.TIME_LIMIT_EXCEEDED, elapsed_ms

            if rc != 0:
                error_msg = stderr or stdout or "Runtime error occurred"
                return stdout, error_msg, ExecutionStatus.RUNTIME_ERROR, elapsed_ms

            return stdout, stderr, ExecutionStatus.ACCEPTED, elapsed_ms

        except Exception as e:
            return "", str(e), ExecutionStatus.RUNTIME_ERROR, 0.0


def compare_output(actual: str, expected: str) -> bool:
    """Normalize and compare outputs."""
    def normalize(s: str) -> str:
        return "\n".join(line.rstrip() for line in s.strip().splitlines())

    return normalize(actual) == normalize(expected)
