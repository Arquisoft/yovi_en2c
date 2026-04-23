Feature: Invalid token

Scenario: User with invalid token is redirected to login
  Given I have an invalid token in localStorage
  When I go to the home page
  Then I should be redirected to the login page