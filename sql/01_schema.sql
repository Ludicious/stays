CREATE TABLE IF NOT EXISTS states (
  code    VARCHAR(10)  NOT NULL,
  name    VARCHAR(100) NOT NULL,
  country VARCHAR(10)  NOT NULL,
  PRIMARY KEY (code)
);

CREATE TABLE IF NOT EXISTS memberships (
  id               INT            AUTO_INCREMENT PRIMARY KEY,
  name             VARCHAR(50)    NOT NULL,
  annual_fee       DECIMAL(10,2)  NOT NULL,
  savings_method   ENUM('percent_off','free_vs_avg','per_stay_value','none') NOT NULL DEFAULT 'none',
  discount_percent DECIMAL(5,2)   NULL,
  per_stay_value   DECIMAL(10,2)  NULL,
  discount_desc    VARCHAR(255),
  affiliate_url    VARCHAR(500),
  active           BOOLEAN        DEFAULT TRUE,
  notes            TEXT,
  created_at       TIMESTAMP      DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS stays (
  id                   INT            AUTO_INCREMENT PRIMARY KEY,
  name                 VARCHAR(255)   NOT NULL,
  city                 VARCHAR(100),
  state                VARCHAR(10),
  country              VARCHAR(10)    DEFAULT 'USA',
  full_address         VARCHAR(500),
  arrival              DATE           NOT NULL,
  departure            DATE           NOT NULL,
  nights               INT            GENERATED ALWAYS AS (DATEDIFF(departure, arrival)) STORED,
  stay_type            ENUM('Paid','Boondocking','Harvest Host','Free','Storage') NOT NULL,
  program              VARCHAR(50),
  status               ENUM('Booked','Deposit Paid','Paid in Full','Stayed','Cancelled') NOT NULL DEFAULT 'Booked',
  total_charged        DECIMAL(10,2)  DEFAULT 0,
  deposit_paid         DECIMAL(10,2)  DEFAULT 0,
  balance_due          DECIMAL(10,2)  GENERATED ALWAYS AS (total_charged - deposit_paid) STORED,
  confirmation_number  VARCHAR(100),
  gate_code            VARCHAR(50),
  check_in_time        VARCHAR(50),
  check_in_instructions TEXT,
  phone                VARCHAR(50),
  email                VARCHAR(255),
  website              VARCHAR(500),
  notes                TEXT,
  created_at           TIMESTAMP      DEFAULT CURRENT_TIMESTAMP,
  updated_at           TIMESTAMP      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_arrival (arrival),
  INDEX idx_status  (status),
  INDEX idx_state   (state)
);
