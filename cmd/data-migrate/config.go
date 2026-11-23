package main

import (
	"flag"
	"fmt"
	"io"
	"os"
	"strings"
	"time"
)

const (
	migrationVersion          = "legacy-main-to-custom-20260919"
	previousMigrationVersion  = "legacy-main-to-custom-20260918"
	markerKey                 = "data-migrate:legacy-main-to-custom"
	authInvalidationMarkerKey = "data-migrate:auth-invalidated"
)

type runMode string

const (
	modeCheck  runMode = "check"
	modeDryRun runMode = "dry-run"
	modeApply  runMode = "apply"
	modeVerify runMode = "verify"
)

type config struct {
	dsn           string
	mode          runMode
	sourceVersion string
	targetVersion string
	reportPath    string
}

type report struct {
	startedAt  time.Time
	finishedAt time.Time
	mode       runMode
	entries    []reportEntry
	errors     []string
}

type reportEntry struct {
	kind   string
	name   string
	detail string
}

func parseConfig() (config, error) {
	flags := flag.NewFlagSet("data-migrate", flag.ContinueOnError)
	flags.SetOutput(io.Discard)

	cfg := config{
		dsn:           os.Getenv("SQL_DSN"),
		mode:          modeCheck,
		sourceVersion: "legacy-main",
		targetVersion: "custom",
	}
	flags.StringVar(&cfg.dsn, "dsn", cfg.dsn, "PostgreSQL DSN; defaults to SQL_DSN")
	flags.Var((*runModeValue)(&cfg.mode), "mode", "check, dry-run, apply, or verify")
	flags.StringVar(&cfg.sourceVersion, "source-version", cfg.sourceVersion, "fixed source version identifier")
	flags.StringVar(&cfg.targetVersion, "target-version", cfg.targetVersion, "fixed target version identifier")
	flags.StringVar(&cfg.reportPath, "report", "", "optional report file path")
	if err := flags.Parse(os.Args[1:]); err != nil {
		return config{}, err
	}
	if strings.TrimSpace(cfg.dsn) == "" {
		return config{}, fmt.Errorf("PostgreSQL DSN is required; use --dsn or SQL_DSN")
	}
	if !strings.HasPrefix(cfg.dsn, "postgres://") && !strings.HasPrefix(cfg.dsn, "postgresql://") {
		return config{}, fmt.Errorf("only PostgreSQL DSNs are supported")
	}
	if cfg.sourceVersion != "legacy-main" || cfg.targetVersion != "custom" {
		return config{}, fmt.Errorf("unsupported migration version pair: %s -> %s", cfg.sourceVersion, cfg.targetVersion)
	}
	return cfg, nil
}

type runModeValue runMode

func (v *runModeValue) String() string {
	return string(*v)
}

func (v *runModeValue) Set(value string) error {
	switch runMode(value) {
	case modeCheck, modeDryRun, modeApply, modeVerify:
		*v = runModeValue(value)
		return nil
	default:
		return fmt.Errorf("invalid mode %q", value)
	}
}

func newReport(mode runMode) *report {
	return &report{startedAt: time.Now().UTC(), mode: mode}
}

func (r *report) add(kind, name, detail string) {
	r.entries = append(r.entries, reportEntry{kind: kind, name: name, detail: detail})
}

func (r *report) addError(err error) {
	if err != nil {
		r.errors = append(r.errors, err.Error())
	}
}

func (r *report) write(w io.Writer) error {
	if r.finishedAt.IsZero() {
		r.finishedAt = time.Now().UTC()
	}
	if _, err := fmt.Fprintf(w, "mode=%s version=%s started_at=%s finished_at=%s\n", r.mode, migrationVersion, r.startedAt.Format(time.RFC3339), r.finishedAt.Format(time.RFC3339)); err != nil {
		return err
	}
	for _, entry := range r.entries {
		if _, err := fmt.Fprintf(w, "[%s] %s: %s\n", entry.kind, entry.name, entry.detail); err != nil {
			return err
		}
	}
	for _, errText := range r.errors {
		if _, err := fmt.Fprintf(w, "[error] %s\n", errText); err != nil {
			return err
		}
	}
	return nil
}

func (r *report) save(path string) error {
	file, err := os.Create(path)
	if err != nil {
		return err
	}
	defer file.Close()
	return r.write(file)
}
