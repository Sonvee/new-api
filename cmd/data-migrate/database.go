package main

import (
	"context"
	"fmt"
	"strings"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func openDatabase(cfg config) (*gorm.DB, error) {
	if !strings.HasPrefix(cfg.dsn, "postgres://") && !strings.HasPrefix(cfg.dsn, "postgresql://") {
		return nil, fmt.Errorf("only PostgreSQL DSNs are supported")
	}
	db, err := gorm.Open(postgres.New(postgres.Config{
		DSN:                  cfg.dsn,
		PreferSimpleProtocol: true,
	}), &gorm.Config{SkipDefaultTransaction: true})
	if err != nil {
		return nil, fmt.Errorf("open PostgreSQL: %w", err)
	}
	sqlDB, err := db.DB()
	if err != nil {
		return nil, fmt.Errorf("get PostgreSQL connection: %w", err)
	}
	if err := sqlDB.PingContext(context.Background()); err != nil {
		_ = sqlDB.Close()
		return nil, fmt.Errorf("ping PostgreSQL: %w", err)
	}
	return db, nil
}

func closeDatabase(db *gorm.DB) error {
	if db == nil {
		return nil
	}
	sqlDB, err := db.DB()
	if err != nil {
		return err
	}
	return sqlDB.Close()
}
