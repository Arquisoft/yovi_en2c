Feature: Session persistence

Scenario: User stays logged in after refreshing
  Given I am logged in with a newly registered user
  When I refresh the page
  Then I should still be on the home page
  And I should see my username