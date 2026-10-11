/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
package console_setting

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestValidateAnnouncementsPinnedField(t *testing.T) {
	t.Run("accepts a boolean pinned field and legacy announcements without it", func(t *testing.T) {
		require.NoError(t, validateAnnouncements(`[{
			"content":"maintenance",
			"publishDate":"2026-09-08T01:44:56Z",
			"type":"warning",
			"pinned":true
		}]`))
		require.NoError(t, validateAnnouncements(`[{
			"content":"legacy",
			"publishDate":"2026-09-08T01:44:56Z"
		}]`))
	})

	t.Run("rejects a non-boolean pinned field", func(t *testing.T) {
		err := validateAnnouncements(`[{
			"content":"maintenance",
			"publishDate":"2026-09-08T01:44:56Z",
			"pinned":"true"
		}]`)
		require.EqualError(t, err, "第1个公告的置顶字段值不合法")
	})
}

func TestSortAnnouncements(t *testing.T) {
	announcements := []map[string]any{
		{
			"content":     "newer unpinned",
			"publishDate": "2026-09-08T04:00:00Z",
		},
		{
			"content":     "older pinned",
			"publishDate": "2026-09-08T02:00:00Z",
			"pinned":      true,
		},
		{
			"content":     "newer pinned",
			"publishDate": "2026-09-08T03:00:00Z",
			"pinned":      true,
		},
		{
			"content":     "older unpinned",
			"publishDate": "2026-09-08T01:00:00Z",
		},
	}

	sortAnnouncements(announcements)

	require.Equal(t, []string{
		"newer pinned",
		"older pinned",
		"newer unpinned",
		"older unpinned",
	}, []string{
		announcements[0]["content"].(string),
		announcements[1]["content"].(string),
		announcements[2]["content"].(string),
		announcements[3]["content"].(string),
	})
}
