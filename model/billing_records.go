package model

import (
	"sort"

	"github.com/QuantumNous/new-api/common"
)

type BillingConsumptionRecord struct {
	Id            int     `json:"id"`
	BillNo        string  `json:"bill_no"`
	Type          string  `json:"type"`
	PaymentMethod string  `json:"payment_method"`
	Amount        float64 `json:"amount"`
	Status        string  `json:"status"`
	CreateTime    int64   `json:"create_time"`
}

type BillingConsumptionFilter struct {
	Keyword       string
	Type          string
	PaymentMethod string
	Status        string
	StartTime     int64
	EndTime       int64
}

func GetUserBillingConsumptions(userId int, pageInfo *common.PageInfo, filter BillingConsumptionFilter) ([]*BillingConsumptionRecord, int64, error) {
	var topups []*TopUp
	topupQuery := DB.Where("user_id = ? AND amount > 0", userId).
		Where("NOT EXISTS (SELECT 1 FROM wallet_ledgers WHERE wallet_ledgers.user_id = top_ups.user_id AND wallet_ledgers.source_type = ? AND wallet_ledgers.source_id = top_ups.trade_no AND wallet_ledgers.type = ?)", "topup", WalletLedgerTypeAdminTopup)
	if filter.Keyword != "" {
		pattern, err := sanitizeLikePattern(filter.Keyword)
		if err != nil {
			return nil, 0, err
		}
		topupQuery = topupQuery.Where("trade_no LIKE ? ESCAPE '!'", pattern)
	}
	if filter.Type == "subscription" {
		topupQuery = topupQuery.Where("1 = 0")
	}
	if filter.PaymentMethod != "" {
		topupQuery = topupQuery.Where("payment_method = ?", filter.PaymentMethod)
	}
	if filter.Status != "" {
		topupQuery = topupQuery.Where("status = ?", filter.Status)
	}
	if filter.StartTime > 0 {
		topupQuery = topupQuery.Where("create_time >= ?", filter.StartTime)
	}
	if filter.EndTime > 0 {
		topupQuery = topupQuery.Where("create_time <= ?", filter.EndTime)
	}
	var topupTotal int64
	if err := topupQuery.Model(&TopUp{}).Count(&topupTotal).Error; err != nil {
		return nil, 0, err
	}

	var subscriptions []*SubscriptionOrder
	subscriptionQuery := DB.Where("user_id = ? AND payment_provider <> ? AND payment_method <> ?", userId, PaymentProviderBalance, PaymentMethodBalance)
	if filter.Keyword != "" {
		pattern, err := sanitizeLikePattern(filter.Keyword)
		if err != nil {
			return nil, 0, err
		}
		subscriptionQuery = subscriptionQuery.Where("trade_no LIKE ? ESCAPE '!'", pattern)
	}
	if filter.Type == "topup" {
		subscriptionQuery = subscriptionQuery.Where("1 = 0")
	}
	if filter.PaymentMethod != "" {
		subscriptionQuery = subscriptionQuery.Where("payment_method = ?", filter.PaymentMethod)
	}
	if filter.Status != "" {
		subscriptionQuery = subscriptionQuery.Where("status = ?", filter.Status)
	}
	if filter.StartTime > 0 {
		subscriptionQuery = subscriptionQuery.Where("create_time >= ?", filter.StartTime)
	}
	if filter.EndTime > 0 {
		subscriptionQuery = subscriptionQuery.Where("create_time <= ?", filter.EndTime)
	}
	var subscriptionTotal int64
	if err := subscriptionQuery.Model(&SubscriptionOrder{}).Count(&subscriptionTotal).Error; err != nil {
		return nil, 0, err
	}

	limit := pageInfo.GetStartIdx() + pageInfo.GetPageSize()
	if limit < pageInfo.GetPageSize() {
		limit = pageInfo.GetPageSize()
	}
	if err := topupQuery.Order("create_time desc, id desc").Limit(limit).Find(&topups).Error; err != nil {
		return nil, 0, err
	}
	if err := subscriptionQuery.Order("create_time desc, id desc").Limit(limit).Find(&subscriptions).Error; err != nil {
		return nil, 0, err
	}

	items := make([]*BillingConsumptionRecord, 0, len(topups)+len(subscriptions))
	for _, topup := range topups {
		items = append(items, &BillingConsumptionRecord{
			Id:            topup.Id,
			BillNo:        topup.TradeNo,
			Type:          "topup",
			PaymentMethod: topup.PaymentMethod,
			Amount:        topup.Money,
			Status:        topup.Status,
			CreateTime:    topup.CreateTime,
		})
	}
	for _, order := range subscriptions {
		items = append(items, &BillingConsumptionRecord{
			Id:            order.Id,
			BillNo:        order.TradeNo,
			Type:          "subscription",
			PaymentMethod: order.PaymentMethod,
			Amount:        order.Money,
			Status:        order.Status,
			CreateTime:    order.CreateTime,
		})
	}
	sort.SliceStable(items, func(i, j int) bool {
		if items[i].CreateTime != items[j].CreateTime {
			return items[i].CreateTime > items[j].CreateTime
		}
		return items[i].Id > items[j].Id
	})
	start := min(pageInfo.GetStartIdx(), len(items))
	end := min(start+pageInfo.GetPageSize(), len(items))
	return items[start:end], topupTotal + subscriptionTotal, nil
}
