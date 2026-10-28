.PHONY: install test security run

install:
	@$(MAKE) -s -C lab install

test:
	@$(MAKE) -s -C lab test
	@$(MAKE) -s security

security:
	PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s security -p 'test_*.py' -v

run:
	@$(MAKE) -s -C lab run
