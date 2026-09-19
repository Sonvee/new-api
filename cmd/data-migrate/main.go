package main

import (
	"fmt"
	"os"
)

func main() {
	cfg, err := parseConfig()
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(2)
	}

	report := newReport(cfg.mode)
	db, err := openDatabase(cfg)
	if err != nil {
		report.addError(err)
		_ = report.write(os.Stdout)
		if cfg.reportPath != "" {
			_ = report.save(cfg.reportPath)
		}
		os.Exit(1)
	}
	defer func() { _ = closeDatabase(db) }()

	switch cfg.mode {
	case modeCheck, modeDryRun, modeApply:
		pf, preflightErr := runPreflight(db, report)
		if preflightErr != nil {
			err = preflightErr
			break
		}
		switch cfg.mode {
		case modeCheck:
			report.add("check", "preflight", "passed")
		case modeDryRun:
			err = runDryRun(db, pf, report)
		case modeApply:
			err = runApply(db, pf, report)
		}
	case modeVerify:
		err = runVerify(db, report)
	}

	if err != nil {
		report.addError(err)
	}
	if cfg.reportPath != "" {
		if saveErr := report.save(cfg.reportPath); saveErr != nil {
			reportError := fmt.Errorf("save report: %w", saveErr)
			report.addError(reportError)
			if err == nil {
				err = reportError
			}
		}
	}
	if writeErr := report.write(os.Stdout); writeErr != nil {
		fmt.Fprintln(os.Stderr, writeErr)
	}
	if err != nil {
		os.Exit(1)
	}
}
