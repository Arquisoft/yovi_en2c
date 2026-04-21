Feature: Protected routes

Scenario: Unauthenticated user cannot access game page
  Given I am not logged in
  When I try to access the game page
  Then I should be redirected to login