# Datum — Project Brief

## Problem

Italy has 6M+ companies but their data is scattered across dozens of disconnected government registries, each with its own format and access method. There's no Italian Crunchbase/ZoomInfo that pulls it all together.

## Solution

A SaaS that aggregates 20+ Italian public data sources into a single searchable intelligence layer, enriched with web scraping and AI analysis.

How it works:

1. Bulk ingest free government data (procurement contracts, state aid, startups, patents, certifications, PEC emails, EU funds, etc.)

2. On-demand lookup via OpenAPI.com commercial registry (cached — pay once per company)

3. Async enrichment via background workers (website scraping, DNS analysis, PageSpeed, Trustpilot, job postings, news)

4. Entity resolution links everything to a unified company profile

5. AI layer powers natural language search, company chat, and news analysis via Claude

## Who it's for

Sales teams researching prospects, compliance officers screening suppliers, investors sourcing deals, anyone who needs to understand an Italian company fast.
